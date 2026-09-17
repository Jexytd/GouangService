# Panduan Operasional & Deployment Rutin - Ricoh Shield API

Dokumen ini menjelaskan alur kerja sehari-hari (*daily developer workflow*) untuk melakukan deployment update kode baru, pemantauan log, rollback, dan backup berkala.

---

## 1. Alur Kerja Deployment Kode Baru

Setelah Anda melakukan perubahan kode di laptop/PC dan melakukan push ke GitHub:

```bash
git add .
git commit -m "feat: your new feature or bugfix"
git push origin main
```

Untuk menerapkan perubahan tersebut di VPS, cukup jalankan skrip deploy satu baris:

```bash
cd /home/ubuntu/GouangService
./deploy/deploy.sh
```

### Apa yang dilakukan `deploy.sh`?
1. Menjalankan *pre-flight check* memastikan file `.env` dan struktur folder valid.
2. Melakukan `git pull` mengambil commit terbaru secara aman.
3. Menginstal dependensi baru via `npm ci --production`.
4. Mereload aplikasi via PM2 dengan strategi **Zero-Downtime** (`pm2 reload`).
5. Menjalankan *health check* otomatis menguji endpoint lokal dan publik.
6. **Otomatis Rollback**: Jika aplikasi gagal boot atau health check gagal, skrip langsung membatalkan update dan mengembalikan kode ke commit sebelumnya tanpa downtime!

---

## 2. Pemantauan Log (Monitoring & Debugging)

Melihat log realtime aplikasi:
```bash
pm2 logs ricoh-shield-api
```

Melihat status ringkas proses PM2:
```bash
pm2 status
```

Melihat 50 baris terakhir error log:
```bash
pm2 logs ricoh-shield-api --err --lines 50 --nostream
```

Melihat log Cloudflare Tunnel:
```bash
sudo journalctl -u cloudflared-ricoh-api -f
```

---

## 3. Melakukan Rollback Manual (Jika Diperlukan)

Jika Anda ingin mengembalikan versi aplikasi ke commit tertentu secara manual:

```bash
# Rollback ke 1 commit sebelum ini
./deploy/rollback.sh

# Atau rollback ke commit hash tertentu
./deploy/rollback.sh a1b2c3d
```

---

## 4. Melakukan Backup Rutin

Jalankan backup sebelum melakukan update besar:
```bash
./deploy/backup.sh
```
File backup terkompresi akan disimpan di folder `backups/`.

Untuk membuat backup yang terenkripsi password (AES-256):
```bash
./deploy/backup.sh ./backups --encrypt
```

---

## 5. Decommissioning Nginx Lama (Opsional)

Jika VPS Anda saat ini masih memiliki instalasi Nginx lama yang tidak digunakan lagi:
```bash
sudo ./deploy/remove-nginx.sh
```
Skrip ini akan mengaudit apakah ada domain lain yang aktif, meminta konfirmasi eksplisit, mem-backup konfigurasi ke `/var/backups`, lalu menghapus paket Nginx secara aman.
