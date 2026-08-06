# 🎥 LiveStream Hub

**Self-hosted 24/7 YouTube Live & Custom RTMP streaming manager for a single VPS.**

A modern, dark-themed dashboard that lets you upload videos, build looping playlists, and stream them non-stop to YouTube Live or any custom RTMP server — with automatic FFmpeg management, crash recovery, live HLS preview, scheduling, logging, backup, and system monitoring.

> ✅ Production-ready · ✅ Ubuntu 22.04 · ✅ Docker · ✅ Nginx + Let's Encrypt · ✅ Low CPU/RAM · ✅ 2–4 core / 4–8 GB VPS

---

## ✨ Features

### Streaming
- **24/7 continuous streaming** — playlist loops forever, no gaps
- **YouTube Live & Custom RTMP** destinations
- **Single video** or **playlist** sources
- **Auto-restart** on FFmpeg crash with watchdog
- **Auto-resume** after VPS reboot (marker file)
- **HLS live preview** in browser
- **Resolution**: 480p / 720p / 1080p / 1440p / 4K
- **FPS**: 24 / 30 / 60
- **Bitrate presets**: 1000 / 2500 / 4500 / 6000 / 8000 kbps
- **Encoders**: x264 (CPU), NVENC (NVIDIA), VAAPI (Intel/AMD), QSV
- **Presets**: ultrafast → slow
- **Volume normalization**, **crossfade**, **video scaling/padding**

### Overlays
- 🖼️ **Image / logo watermark** (position + opacity)
- 📜 **Scrolling text** overlay
- 🕒 **Live timestamp** overlay

### Dashboard
- Total videos, playlists, running/stopped streams
- Live CPU / RAM / Disk / Network gauges
- Current bitrate, FPS, resolution
- Uptime, dropped frames
- Recent activity feed

### Video Library
- Upload MP4, MKV, MOV, AVI, WEBM
- Drag & drop + multi-file upload with progress bars
- Auto thumbnails via FFmpeg
- Play, rename, delete, download
- Folder organization

### Playlist Manager
- Create, duplicate, delete
- Drag-to-reorder ready
- Shuffle, repeat, loop forever
- Total duration preview
- Add/remove videos

### Scheduler
- Start date/time, stop time
- Repeat: none / daily / weekly (choose days) / monthly
- Auto-start and auto-stop

### Logs
- Live FFmpeg logs with search
- Activity logs (stream, upload, system, errors)
- Download & clear

### File Manager
- Browse folders, view resolution/duration/size

### System Monitor
- Real-time CPU/RAM/disk/network/temperature
- Load average, process count
- FFmpeg version & hardware encoder detection

### Backup & Restore
- One-click backups (videos, thumbnails, database, settings)
- Download / restore / delete old backups
- `backup.sh` for cron-based daily backups

### Security
- 🔐 Single admin login with **JWT** auth
- 🔒 **bcrypt** password hashing
- 🛡️ **Helmet** security headers, **CORS**, **rate limiting**
- 🔑 Change password in UI
- 🚪 Session logout with token blacklist
- HTTPS-ready (Nginx + Let's Encrypt)

---

## 🚀 One-Command Install (Ubuntu 22.04 / Debian 12)

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/livestream-hub/main/install.sh | sudo bash
```

Or clone and run locally:

```bash
git clone https://github.com/your-org/livestream-hub.git
cd livestream-hub
sudo bash install.sh
```

The installer:
1. Installs Docker + Docker Compose
2. Installs FFmpeg
3. Builds and starts the container
4. Configures Nginx reverse proxy
5. Obtains Let's Encrypt SSL certificate
6. Creates systemd service for auto-start on boot
7. Configures UFW firewall

When finished, visit `https://your-domain.com` and log in with **admin / admin123**.

> ⚠️ **Change your password immediately** after first login (Settings → Change Password).

---

## 🐳 Quick Start with Docker

```bash
# 1. Clone
git clone https://github.com/your-org/livestream-hub.git
cd livestream-hub

# 2. Configure
cp .env.example .env
# Edit JWT_SECRET, ADMIN_PASSWORD

# 3. Build and run
docker compose up -d --build

# 4. Open
# http://your-server-ip:8080
```

### Docker Compose Configuration

All data is stored in `./storage` (mounted as a volume):
- `videos/` — uploaded video files
- `thumbnails/` — generated thumbnails
- `hls/` — live HLS preview segments
- `backups/` — backups
- `logs/` — app & FFmpeg logs
- `livestream-hub.db` — SQLite database

---

## 🛠️ Manual Installation (No Docker)

### Requirements
- Node.js 20+
- FFmpeg (with libx264)
- Ubuntu 22.04 / Debian 12

```bash
# Backend
cd backend
npm install
npm run build
npm start

# Frontend (in another terminal)
cd frontend
npm install
npm run build
# The static export is served by the backend at frontend/out/
```

Backend runs on port `8080` by default.

---

## ⚙️ Configuration

All config is via environment variables (`.env` file or system env):

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | *(generated)* | Secret for JWT signing — **change this** |
| `JWT_EXPIRES_IN` | `7d` | Session lifetime |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `admin123` | Initial admin password |
| `PORT` | `8080` | Backend port |
| `DB_TYPE` | `sqlite` | `sqlite` or `mysql` |
| `STORAGE_DIR` | `./storage` | Data directory |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | Path to ffmpeg binary |
| `FFPROBE_PATH` | `/usr/bin/ffprobe` | Path to ffprobe binary |
| `AUTO_RESUME_ON_BOOT` | `true` | Resume streams after reboot |
| `WATCHDOG_ENABLED` | `true` | Monitor & auto-restart crashes |
| `TZ` | `UTC` | Container timezone |

### Environment variables in docker-compose.yml

Edit the `environment:` section or put them in `.env`.

---

## 🖥️ Hardware Acceleration

### NVIDIA NVENC
Uncomment in `docker-compose.yml`:
```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```
Install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) on host.

### Intel/AMD VAAPI
Uncomment:
```yaml
devices:
  - /dev/dri:/dev/dri
```

The app auto-detects available encoders and shows them in the Streaming UI.

---

## 🔄 Auto-Update & Backups

### Daily backup via cron
```bash
sudo crontab -e
# Add:
0 3 * * * /opt/livestream-hub/backup.sh
```

### Update
```bash
cd /opt/livestream-hub
sudo bash update.sh
```

---

## 📡 YouTube Live Setup

1. Go to [YouTube Studio → Stream](https://studio.youtube.com/)
2. Copy the **Stream URL** (`rtmp://a.rtmp.youtube.com/live2`) and **Stream key**
3. In LiveStream Hub → Streaming → New Stream Profile
4. Select **YouTube Live**, paste URL + key
5. Choose a playlist, set resolution/bitrate (recommended: 1080p / 4500 kbps)
6. Click **Start**

For 24/7 streaming, keep the same stream key — YouTube will treat it as a single continuous broadcast.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript, hls.js, SWR, Zustand |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite (better-sqlite3) / MySQL optional |
| Streaming | FFmpeg (fluent-ffmpeg / spawn) |
| Real-time | WebSocket (ws) |
| Auth | JWT + bcrypt |
| Deployment | Docker, docker-compose, Nginx, systemd, Let's Encrypt |
| Monitoring | systeminformation |

---

## 📂 Project Structure

```
livestream-hub/
├── backend/
│   └── src/
│       ├── index.ts           # Express server + WebSocket
│       ├── db/                # SQLite init + schema
│       ├── routes/            # API routes
│       ├── services/          # FFmpeg manager, scheduler, backup, system
│       ├── middleware/        # Auth (JWT)
│       ├── utils/             # Settings, logger
│       └── types/
├── frontend/
│   └── src/
│       ├── app/               # Next.js App Router pages
│       ├── components/        # Sidebar, Modal, Toast, etc.
│       └── lib/               # API client, types, helpers
├── storage/                   # Mounted volume (videos, db, logs, etc.)
├── deploy/                    # Nginx config, systemd unit, crontab
├── Dockerfile
├── docker-compose.yml
├── install.sh                 # One-command installer
├── update.sh
└── backup.sh
```

---

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login → returns JWT |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/dashboard/stats` | Dashboard metrics |
| GET/POST | `/api/videos` | List / upload videos |
| PATCH/DELETE | `/api/videos/:id` | Rename / delete |
| GET/POST/PATCH/DELETE | `/api/playlists[/:id]` | CRUD playlists |
| POST | `/api/playlists/:id/duplicate` | Duplicate |
| GET/POST/PUT/DELETE | `/api/streams/profiles[/:id]` | Stream profiles |
| POST | `/api/streams/:id/start` | Start streaming |
| POST | `/api/streams/:id/stop` | Stop |
| POST | `/api/streams/:id/restart` | Restart |
| GET | `/api/streams/:id/logs` | FFmpeg logs |
| GET/POST | `/api/schedules` | Schedule streams |
| GET | `/api/system/stats` | System metrics |
| GET | `/api/system/ffmpeg-info` | FFmpeg / encoder detection |
| GET/POST | `/api/backup` | List / create backups |
| GET/PUT | `/api/settings` | App settings |
| WS | `/ws` | Real-time stream status events |

---

## 🐛 Troubleshooting

**View logs:**
```bash
docker compose logs -f
docker compose logs -f livestream-hub
```

**Enter the container:**
```bash
docker compose exec livestream-hub bash
```

**Restart:**
```bash
docker compose restart
```

**Stream won't start:**
- Check FFmpeg path in Settings
- Check the destination URL & stream key
- Make sure the source video/playlist has files
- Check Logs page for FFmpeg errors
- For hardware encoders, verify GPU is accessible from the container

**HLS preview not playing:**
- Ensure `hls_preview` is enabled on the stream profile
- Wait ~10 seconds after starting for the first segments
- Check the browser console for CORS / mixed-content warnings

---

## 📝 License

MIT — free for personal and commercial use.

---

## 🙏 Credits

Built with [FFmpeg](https://ffmpeg.org/), [Next.js](https://nextjs.org/), [Express](https://expressjs.com/), and [Tailwind CSS](https://tailwindcss.com/).
