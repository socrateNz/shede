#!/bin/bash
# Tâches planifiées de Shede (crontab d'etarcosdev) : appelle une route /api/cron/<tâche> de
# l'application locale avec le secret CRON_SECRET (en-tête lu dans ~/.secrets/shede-cron-entete,
# jamais affiché ni passé sur la ligne de commande).
# Usage : taches-shede.sh webhooks | forecasts | license-reminders
# Journal : ~/apps/shede-taches.log — la relance des webhooks (chaque minute) n'y écrit qu'en cas d'échec.
set -uo pipefail

tache=${1:?tâche manquante}
case "$tache" in
  webhooks | forecasts | license-reminders) ;;
  *) echo "tâche inconnue : $tache" >&2; exit 2 ;;
esac

journal=/home/etarcosdev/apps/shede-taches.log
exec 9> "/tmp/shede-tache-$tache.lock"
flock -n 9 || { echo "$(date -Is) $tache : exécution précédente encore en cours" >> "$journal"; exit 0; }

reponse=$(curl -sS --max-time 600 -w '\n%{http_code}' \
  -H @/home/etarcosdev/.secrets/shede-cron-entete \
  "http://127.0.0.1:3001/api/cron/$tache" 2>&1)
code=${reponse##*$'\n'}
corps=${reponse%$'\n'*}

if [ "$code" != "200" ]; then
  echo "$(date -Is) $tache : ÉCHEC (HTTP $code) ${corps:0:1500}" >> "$journal"
  exit 1
fi
if [ "$tache" != "webhooks" ]; then
  echo "$(date -Is) $tache : OK ${corps:0:1500}" >> "$journal"
fi
