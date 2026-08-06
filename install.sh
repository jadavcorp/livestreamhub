#!/usr/bin/env bash
# ============================================================================
# LiveStream Hub - One-Command Installer for Ubuntu 22.04 / Debian 12
# Usage: curl -fsSL https://your-server/install.sh | sudo bash
#   or:  sudo bash install.sh
# ============================================================================
set -euo pipefail

APP_NAME="livestream-hub"
APP_DIR="/opt/livestream-hub"
DATA_DIR="/var/lib/livestream-hub"
SERVICE_USER="livestream"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
PORT="${PORT:-8080}"
USE_NGINX="${USE_NGINX:-yes}"
USE_SSL="${USE_SSL:-yes}"
INSTALL_DOCKER="${INSTALL_DOCKER:-yes}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $*"; }
info() { echo -e "${CYAN}[i]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*" >&2; }

if [[ $EUID -ne 0 ]]; then err "Please run as root (sudo bash install.sh)"; exit 1; fi

echo ""
echo "============================================"
echo "   LiveStream Hub Installer"
echo "============================================"
echo ""

# Prompt for domain/email if not set
if [[ -z "$DOMAIN" ]]; then
  read -rp "Domain name (e.g. stream.example.com) or leave blank for IP-only: " DOMAIN
fi
if [[ -n "$DOMAIN" && -z "$EMAIL" ]]; then
  read -rp "Email for Let's Encrypt SSL: " EMAIL
fi

# ---------- System packages ----------
info "Updating system packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl wget ca-certificates gnupg lsb-release ufw sqlite3 >/dev/null

# ---------- Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  if [[ "$INSTALL_DOCKER" == "yes" ]]; then
    info "Installing Docker…"
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
    log "Docker installed"
  fi
else
  log "Docker already installed: $(docker --version)"
fi

# Install docker-compose plugin if missing
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin || true
fi

# ---------- FFmpeg on host (optional; container has it too) ----------
if ! command -v ffmpeg >/dev/null 2>&1; then
  info "Installing FFmpeg on host…"
  apt-get install -y -qq ffmpeg
fi
log "FFmpeg: $(ffmpeg -version 2>/dev/null | head -1 || echo 'in container')"

# ---------- App user & dirs ----------
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi
mkdir -p "$APP_DIR" "$DATA_DIR"/{videos,thumbnails,hls,backups,logs,uploads}

# Copy project files (if running from source)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
  cp -r "$SCRIPT_DIR"/* "$APP_DIR/" 2>/dev/null || true
  cp "$SCRIPT_DIR/.env.example" "$APP_DIR/.env" 2>/dev/null || true
fi

cd "$APP_DIR"

# Generate secrets
if [[ ! -f .env ]] || grep -q "change-me" .env 2>/dev/null; then
  JWT_SECRET=$(openssl rand -hex 32)
  cat > .env <<EOF
JWT_SECRET=$JWT_SECRET
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
TZ=$(timedatectl show -p Timezone --value 2>/dev/null || echo UTC)
AUTO_RESUME_ON_BOOT=true
WATCHDOG_ENABLED=true
EOF
  log "Generated .env with secure JWT secret"
fi

# Set port
sed -i "s|8080:8080|${PORT}:8080|" docker-compose.yml 2>/dev/null || true

chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR"
chmod -R 750 "$DATA_DIR"

# ---------- Build & start ----------
info "Building and starting LiveStream Hub (first build takes several minutes)…"
docker compose build
docker compose up -d
log "Container started"

# ---------- Firewall ----------
info "Configuring firewall…"
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw allow ${PORT}/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true
log "Firewall configured"

# ---------- Nginx + SSL ----------
if [[ "$USE_NGINX" == "yes" ]]; then
  if ! command -v nginx >/dev/null 2>&1; then
    info "Installing Nginx…"
    apt-get install -y -qq nginx
  fi

  if [[ -n "$DOMAIN" ]]; then
    cat > /etc/nginx/sites-available/$APP_NAME <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 0;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    log "Nginx reverse proxy configured for $DOMAIN"

    if [[ "$USE_SSL" == "yes" && -n "$EMAIL" ]]; then
      info "Obtaining Let's Encrypt SSL certificate…"
      apt-get install -y -qq certbot python3-certbot-nginx
      certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect
      log "SSL installed: https://$DOMAIN"
    fi
  else
    warn "No domain provided - skipping Nginx/SSL. Access at http://<server-ip>:${PORT}"
  fi
fi

# ---------- systemd watchdog (optional, ensures container is up) ----------
cat > /etc/systemd/system/${APP_NAME}.service <<EOF
[Unit]
Description=LiveStream Hub (Docker Compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable ${APP_NAME}.service >/dev/null
log "systemd service enabled (auto-start on boot)"

# ---------- Done ----------
PUBLIC_IP=$(curl -fsS https://api.ipify.org 2>/dev/null || echo "<server-ip>")
echo ""
echo "============================================"
echo -e "${GREEN}  LiveStream Hub installed successfully!${NC}"
echo "============================================"
echo ""
if [[ -n "$DOMAIN" ]]; then
  echo "  URL:      https://$DOMAIN"
else
  echo "  URL:      http://$PUBLIC_IP:${PORT}"
fi
echo "  User:     admin"
echo "  Password: admin123  (change immediately after login)"
echo "  Data:     $DATA_DIR"
echo "  App:      $APP_DIR"
echo ""
echo "  Commands:"
echo "    cd $APP_DIR"
echo "    docker compose logs -f     # view logs"
echo "    docker compose restart     # restart"
echo "    docker compose down        # stop"
echo "    sudo bash update.sh        # update"
echo ""
warn "IMPORTANT: Change your admin password after first login!"
echo ""
