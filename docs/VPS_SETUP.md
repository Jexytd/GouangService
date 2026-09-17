# Panduan Setup VPS Baru - Ricoh Shield Headless API

Dokumentasi ini menjelaskan langkah-langkah menyiapkan server Ubuntu VPS baru untuk menjalankan **Ricoh Shield Headless API** menggunakan arsitektur **Cloudflare Tunnel → 127.0.0.1:3000** tanpa perlu menggunakan Nginx.

---

## 1. Persyaratan Sistem
- **OS**: Ubuntu 20.04 / 22.04 / 24.04 LTS (x86_64 atau ARM64)
- **RAM**: Minimal 1 GB
- **Hak Akses**: User dengan akses `sudo` (misal user `ubuntu` atau `root`)
- **Port SSH**: Port `9017` (atau port kustom yang Anda tentukan)

---

## 2. Setup Otomatis (Metode Tercepat - Rekomendasi)

Setelah Anda login via SSH ke VPS baru:

```bash
# 1. Update paket dasar & instal Git
sudo apt update && sudo apt install -y git

# 2. Clone repository ke direktori standar
git clone https://github.com/Jexytd/GouangService.git /home/ubuntu/GouangService
cd /home/ubuntu/GouangService

# 3. Berikan izin eksekusi pada skrip deployment
chmod +x deploy/*.sh

# 4. Jalankan script bootstrap
sudo ./deploy/bootstrap.sh
```

Skrip `bootstrap.sh` secara otomatis akan:
1. Memperbarui sistem dan menginstal dependensi inti (`curl`, `git`, `jq`, `ufw`, dll).
2. Menginstal **Node.js 20 LTS** dan **PM2**.
3. Menginstal daemon **cloudflared** resmi dari Cloudflare.
4. Meminta konfigurasi secrets (`.env`) secara interaktif dan aman.
5. Memasang konfigurasi Cloudflare Tunnel di `/etc/cloudflared/ricoh-api.yml`.
6. Memasang systemd service `cloudflared-ricoh-api.service`.
7. Mengaktifkan process supervisor PM2 agar berjalan otomatis saat boot (`pm2 startup`).
8. Mengonfigurasi UFW Firewall (mengizinkan port SSH `9017` dan memblokir port `3000` dari akses publik).
9. Melakukan uji kesehatan (*health check*) lokal dan publik.

---

## 3. Menghubungkan File Kredensial Cloudflare Tunnel

Jika Anda menggunakan tunnel yang sudah ada (`51f06a50-5435-427a-aa8f-6fb311146a37`), letakkan file kredensial JSON Anda ke:

```bash
sudo cp /path/to/51f06a50-5435-427a-aa8f-6fb311146a37.json /etc/cloudflared/51f06a50-5435-427a-aa8f-6fb311146a37.json
sudo chmod 600 /etc/cloudflared/*.json
sudo systemctl restart cloudflared-ricoh-api
```

Cek status koneksi tunnel:
```bash
sudo systemctl status cloudflared-ricoh-api
```

---

## 4. Verifikasi Status Layanan

Jalankan skrip health check bawaan:
```bash
./deploy/healthcheck.sh all
```

Output yang diharapkan:
```text
[SUCCESS] LOCAL API (127.0.0.1:3000) is HEALTHY! (HTTP 200 - status: online)
[SUCCESS] PUBLIC API (api.tamammrbeast.my.id) is HEALTHY! (HTTP 200 - status: online)
```
