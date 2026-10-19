#!/bin/bash
# Restaure la base Shede depuis Backblaze B2 : dernière copie complète, puis toutes les
# modifications archivées (ou seulement jusqu'à une heure précise).
#
# Tourne dans un conteneur postgres:17 (Debian) : wal-g ne fonctionne pas dans l'image Alpine
# de Supabase. Le dossier obtenu est une base cohérente, arrêtée proprement, avec les droits
# de supabase-db (100:101) : elle peut remplacer volumes/db/data telle quelle.
# La base restaurée n'archive rien : B2 n'est jamais modifié par une restauration.
#
# Usage, depuis ~/apps/shede-supabase :
#   sudo sauvegarde/restaurer.sh <dossier-neuf> ["2026-10-19 14:32:00+01"]
#   sudo env VERIF="select …" sauvegarde/restaurer.sh …   (requête de contrôle affichée à la fin)
set -euo pipefail

cible=${1:?dossier cible manquant}
heure=${2:-}
if [ -e "$cible" ]; then
  echo "$cible existe déjà : indiquer un dossier neuf" >&2
  exit 1
fi
mkdir -p "$cible"

docker run --rm --name shede-restauration \
  --env-file sauvegarde/walg.env \
  -e HEURE="$heure" -e VERIF="${VERIF:-}" \
  -v "$PWD/sauvegarde/wal-g:/usr/local/bin/wal-g:ro" \
  -v /etc/ssl/certs:/etc/ssl/certs:ro \
  -v "$(realpath "$cible"):/var/lib/postgresql/data" \
  postgres:17-bookworm bash -euo pipefail -c '
D=/var/lib/postgresql/data
echo "== Copie complète depuis B2"
wal-g backup-fetch "$D" LATEST

# Réglages de la restauration seule (supabase-db utilise son propre fichier de configuration)
cat >> "$D/postgresql.conf" <<EOF

# --- restauration Shede ---
listen_addresses = '"''"'
archive_mode = off
restore_command = '"'"'wal-g wal-fetch %f %p'"'"'
recovery_target_action = '"'"'promote'"'"'
EOF
if [ -n "$HEURE" ]; then
  echo "recovery_target_time = '"'"'$HEURE'"'"'" >> "$D/postgresql.conf"
fi
echo "local all all trust" > "$D/pg_hba.conf"
touch "$D/recovery.signal"
chown -R postgres:postgres "$D" && chmod 700 "$D"

echo "== Rejeu des modifications archivées${HEURE:+ jusqu à $HEURE}"
gosu postgres pg_ctl -D "$D" -l /tmp/restauration.log -w -t 3600 start
until [ "$(gosu postgres psql -U supabase_admin -d postgres -tAc "select pg_is_in_recovery()" 2>/dev/null)" = "f" ]; do
  # Postgres arrêté en cours de route : on montre pourquoi au lieu d attendre sans fin
  gosu postgres pg_ctl -D "$D" status > /dev/null || { tail -30 /tmp/restauration.log; exit 1; }
  sleep 2
done
grep -E "redo done|recovery stopping|archive recovery complete|selected new timeline" /tmp/restauration.log || true

echo "== Contrôle"
gosu postgres psql -U supabase_admin -d postgres -tAc \
  "select '"'"'tables public : '"'"' || count(*) from information_schema.tables where table_schema = '"'"'public'"'"'"
if [ -n "$VERIF" ]; then
  gosu postgres psql -U supabase_admin -d postgres -c "$VERIF"
fi

gosu postgres pg_ctl -D "$D" -m fast -w stop
chown -R 100:101 "$D"
echo "== Restauration terminée : base arrêtée proprement, prête pour supabase-db"
'
