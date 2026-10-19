#!/bin/bash
# Déploie une version de Shede sur le VPS (même principe que deployer-meddoc.sh) :
# clone du commit demandé dans un nouveau dossier, .env partagé, installation, compilation
# (avec le cache de la version en ligne), bascule du lien shede-actuelle, redémarrage PM2,
# vérification. Si l'application ne répond pas : retour automatique à la version précédente.
#
# Usage : ~/scripts/deployer-shede.sh [commit]      (sans argument : dernier commit de main)
# GitHub Actions l'appelle par une clé SSH limitée à ce script : le commit arrive alors
# dans SSH_ORIGINAL_COMMAND.
set -euo pipefail

APP=shede
BASE=/home/etarcosdev/apps
DEPOT=git@github-shede:socrateNz/shede.git
PORT=3001
GARDER=3
JOURNAL=$BASE/deploiements.log

exec 9> /tmp/deployer-$APP.lock
flock -n 9 || { echo "Un déploiement de $APP est déjà en cours."; exit 1; }

demande=${1:-${SSH_ORIGINAL_COMMAND:-}}
# Seul un identifiant de commit est accepté (la clé GitHub ne peut rien passer d'autre)
if [ -n "$demande" ] && ! [[ "$demande" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "Identifiant de commit invalide : $demande"
  exit 1
fi

journal() { echo "$(date -Is) $APP $*" | tee -a "$JOURNAL"; }

# 1. Code
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git clone --quiet --filter=blob:none "$DEPOT" "$tmp/src"
cd "$tmp/src"
if [ -n "$demande" ]; then git checkout --quiet "$demande"; fi
commit=$(git rev-parse --short HEAD)
version="$(date +%Y%m%d-%H%M%S)-$commit"
dest=$BASE/$APP-versions/$version
mkdir -p "$BASE/$APP-versions"
mv "$tmp/src" "$dest"
cd "$dest"
journal "début $version"

# 2. Configuration partagée et cache de compilation de la version en ligne
ln -s "$BASE/$APP-partage/.env" .env
if [ -d "$BASE/$APP-actuelle/.next/cache" ]; then
  mkdir -p .next
  cp -a "$BASE/$APP-actuelle/.next/cache" .next/
fi

# 3. Installation et compilation (les variables NEXT_PUBLIC_ du .env sont figées ici)
pnpm install --frozen-lockfile
pnpm build

# 4. Bascule
precedente=$(readlink -f "$BASE/$APP-actuelle" 2>/dev/null || true)
ln -sfn "$dest" "$BASE/$APP-actuelle"
pm2 restart "$APP" --update-env 2>/dev/null || pm2 start "$BASE/ecosystem.config.cjs" --only "$APP"

# 5. Vérification : la page de connexion doit répondre
repond() {
  for _ in $(seq 1 30); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/login" || true)" = "200" ] && return 0
    sleep 2
  done
  return 1
}

if repond; then
  pm2 save > /dev/null
  journal "OK $version"
  # Ménage : les $GARDER versions les plus récentes sont gardées
  ls -1d "$BASE/$APP-versions"/*/ | sort | head -n -"$GARDER" | while read -r ancienne; do
    [ "$(readlink -f "$ancienne")" = "$(readlink -f "$BASE/$APP-actuelle")" ] || rm -rf "$ancienne"
  done
else
  journal "ÉCHEC $version : l'application ne répond pas"
  if [ -n "$precedente" ] && [ -d "$precedente" ]; then
    ln -sfn "$precedente" "$BASE/$APP-actuelle"
    pm2 restart "$APP" --update-env
    journal "retour à $(basename "$precedente")"
  fi
  exit 1
fi
