# Shede : application Next.js (127.0.0.1:3001) et API Supabase auto-hébergée (127.0.0.1:8000)
# sous la même adresse. Seules les routes dont le navigateur a besoin sont ouvertes vers Supabase :
# les données (/rest/v1) et le temps réel (/realtime/v1). Le tableau de bord Supabase (Studio)
# n'est jamais exposé : accès par tunnel SSH uniquement.
# HTTPS ajouté ensuite par : sudo certbot --nginx -d shede.tacynt.com --redirect
server {
    listen 80;
    server_name shede.tacynt.com;

    client_max_body_size 10m;

    location /rest/v1/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }

    location /realtime/v1/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;   # écrase la valeur du client : non falsifiable
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }
}
