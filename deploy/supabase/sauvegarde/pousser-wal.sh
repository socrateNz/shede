#!/bin/sh
# Conteneur shede-sauvegarde : envoie vers B2 (compressés et chiffrés par wal-g) les segments
# WAL copiés par Postgres dans /wal-archive, puis les retire. Un envoi qui échoue (réseau, B2)
# laisse le fichier en place : il repart au tour suivant, dans l'ordre. Rien n'est perdu.
set -u
while true; do
  for f in $(find /wal-archive -maxdepth 1 -type f ! -name '*.tmp' -printf '%f\n' | sort); do
    if wal-g wal-push "/wal-archive/$f"; then
      rm -f "/wal-archive/$f"
    else
      echo "$(date -Is) échec de l'envoi de $f, nouvel essai dans 5 s" >&2
      break
    fi
  done
  date +%s > /tmp/dernier-tour
  sleep 5
done
