# SOP & Checklist Migrasi VPS - Ricoh Shield Headless API

Dokumen ini memuat prosedur resmi dan checklist saat Anda berpindah dari VPS lama ke VPS baru agar proses migrasi selesai dalam waktu **kurang dari 10 menit**.

---

## Migration Checklist

Gunakan checklist ini untuk memantau kemajuan migrasi:

```text
[ ] 1. BACKUP DARI VPS LAMA
    [ ] Jalankan ./deploy/backup.sh di VPS lama
    [ ] Download file ricoh_shield_backup_*.tar.gz ke komputer lokal

[ ] 2. PERSIAPAN VPS BARU
    [ ] VPS Ubuntu baru aktif dan dapat diakses via SSH
    [ ] Pastikan port SSH dikonfigurasi (misal: port 9017)
    [ ] Git terinstal di VPS baru (sudo apt install -y git)

[ ] 3. PROVISIONING & RESTORE
    [ ] Clone repository GouangService ke /home/ubuntu/GouangService
    [ ] Upload file backup ke VPS baru
    [ ] Jalankan ./deploy/restore.sh <path_backup>
    [ ] Jalankan sudo ./deploy/bootstrap.sh

[ ] 4. VERIFIKASI LAYANAN
    [ ] Node.js aktif di PM2 (pm2 status)
    [ ] Cloudflare Tunnel aktif (systemctl status cloudflared-ricoh-api)
    [ ] Local health check lulus (curl http://127.0.0.1:3000/)
    [ ] Public health check lulus (curl https://api.tamammrbeast.my.id/)
    [ ] Dashboard Vercel berhasil terhubung ke API

[ ] 5. PERSISTENCE REBOOT TEST
    [ ] Jalankan sudo reboot
    [ ] Tunggu 1 menit, login kembali
    [ ] Pastikan API tetap online tanpa intervensi manual
```

---

## Prosedur Langkah Demi Langkah

### Langkah 1: Buat Backup di VPS Lama
Jalankan perintah berikut pada VPS lama:
```bash
cd /home/ubuntu/GouangService
./deploy/backup.sh
```
File backup akan tersimpan di folder `backups/` dengan nama seperti:
`ricoh_shield_backup_20260917_093000.tar.gz`

Download file ini ke komputer Anda menggunakan `scp`:
```bash
scp -P 9017 ubuntu@IP_VPS_LAMA:/home/ubuntu/GouangService/backups/ricoh_shield_backup_*.tar.gz ./
```

---

### Langkah 2: Setup VPS Baru & Clone Repositori
Login ke VPS baru Anda, lalu jalankan:
```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/Jexytd/GouangService.git /home/ubuntu/GouangService
cd /home/ubuntu/GouangService
chmod +x deploy/*.sh
```

---

### Langkah 3: Transfer & Restore Backup ke VPS Baru
Kirimkan file backup dari komputer Anda ke VPS baru:
```bash
scp -P 9017 ./ricoh_shield_backup_*.tar.gz ubuntu@IP_VPS_BARU:/home/ubuntu/
```

Lalu di VPS baru, ekstrak dan pulihkan data:
```bash
sudo ./deploy/restore.sh /home/ubuntu/ricoh_shield_backup_*.tar.gz
```
Skrip ini akan secara otomatis menempatkan file database `whitelist.json`, file `.env`, dan kredensial Cloudflare Tunnel ke lokasi yang tepat.

---

### Langkah 4: Jalankan Bootstrap Otomatis
```bash
sudo ./deploy/bootstrap.sh
```
Karena `.env` dan kredensial Cloudflare sudah di-restore pada Langkah 3, skrip bootstrap akan langsung menggunakan data tersebut dan mengaktifkan service dalam sekali jalan!

---

### Langkah 5: Uji Coba Reboot
Pastikan infrastruktur bertahan saat VPS di-restart:
```bash
sudo reboot
```
Setelah reboot, buka terminal dan jalankan:
```bash
./deploy/healthcheck.sh all
```
Jika kedua check bertanda **SUCCESS**, migrasi VPS Anda telah berhasil 100%!
