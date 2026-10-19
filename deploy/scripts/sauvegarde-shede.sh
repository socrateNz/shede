#!/bin/bash
# Copie complète de la base Shede vers Backblaze B2 (wal-g, conteneur shede-sauvegarde), puis ménage.
# Garde 7 copies complètes et toutes les modifications archivées entre elles : retour possible
# à n'importe quel instant des 7 derniers jours. Lancé chaque nuit par /etc/cron.d/shede-sauvegarde.
set -euo pipefail
exec >> /home/etarcosdev/backups/shede-sauvegarde.log 2>&1
exec 9> /run/lock/shede-sauvegarde.lock
flock -n 9 || { echo "$(date -Is) déjà en cours, abandon"; exit 1; }
echo "=== $(date -Is) début"
docker exec shede-sauvegarde wal-g backup-push /var/lib/postgresql/data
docker exec shede-sauvegarde wal-g delete retain FULL 7 --confirm
docker exec shede-sauvegarde wal-g backup-list
echo "=== $(date -Is) fin OK"
