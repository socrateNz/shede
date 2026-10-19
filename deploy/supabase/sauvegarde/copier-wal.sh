#!/bin/sh
# Appelé par Postgres (archive_command, conteneur supabase-db) pour chaque segment WAL terminé :
# le copie dans le dossier partagé, d'où shede-sauvegarde l'envoie chiffré vers B2.
# Code 0 = segment en sécurité ; autre code = Postgres garde le segment et réessaie.
set -e
dir=/var/lib/postgresql/wal-archive
# Déjà copié (nouvel essai après une coupure) : succès seulement si c'est le même contenu
if [ -f "$dir/$2" ]; then
  cmp -s "$1" "$dir/$2"
  exit $?
fi
cp "$1" "$dir/$2.tmp"
sync
mv "$dir/$2.tmp" "$dir/$2"
sync
