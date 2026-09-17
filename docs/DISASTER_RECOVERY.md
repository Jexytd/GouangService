# Panduan Pemulihan Bencana (Disaster Recovery)

Panduan ini digunakan jika **VPS LAMA MATI TOTAL / HILANG / TIDAK DAPAT DIAKSES**, dan Anda harus menyalakan kembali Ricoh Shield Headless API pada VPS baru dari nol.

---

## Aset yang Anda Miliki
Dalam skenario bencana ini, diasumsikan Anda hanya memiliki:
1. Akses ke Repositori GitHub (`GouangService`).
2. Akun Cloudflare (`tamammrbeast.my.id`).
3. Kredensial atau Token Tunnel Cloudflare.
4. Nilai-nilai konfigurasi secrets (`DASHBOARD_PASSWORD`, `SERVER_SECRET`).
5. Backup lokal database `whitelist.json` (jika ada).

---

## Alur Pemulihan Cepat (< 5 Menit)

```text
Fresh Ubuntu VPS Dinyalakan
           ↓
Login SSH ke VPS Baru
           ↓
git clone https://github.com/Jexytd/GouangService.git
           ↓
sudo ./deploy/bootstrap.sh
(Ketikkan password admin & secret pada prompt)
           ↓
Hubungkan Kredensial Cloudflare Tunnel
           ↓
./deploy/healthcheck.sh all
           ↓
API ONLINE KEMBALI
```

---

## Langkah Detail Pemulihan

### 1. Nyalakan VPS Baru & Clone Repositori
Login ke VPS baru via SSH:
```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/Jexytd/GouangService.git /home/ubuntu/GouangService
cd /home/ubuntu/GouangService
chmod +x deploy/*.sh
```

---

### 2. Jalankan Master Bootstrap
Jalankan skrip penyedia otomatis:
```bash
sudo ./deploy/bootstrap.sh
```

Skrip akan meminta input data secrets:
- **Dashboard Admin Password**: Masukkan password dashboard Anda.
- **Server Secret Salt**: Masukkan string salt rahasia Anda.
- **Discord Bot Token**: Masukkan token bot (atau enter jika tanpa bot).
- **Cloudflare Tunnel ID**: Masukkan Tunnel ID Anda (`51f06a50-5435-427a-aa8f-6fb311146a37`).

---

### 3. Sambungkan Kredensial Cloudflare Tunnel

Pilih salah satu metode berikut sesuai apa yang Anda miliki:

#### Opsi A: Anda Memiliki File JSON Kredensial Tunnel
Buat file kredensial di `/etc/cloudflared/`:
```bash
sudo nano /etc/cloudflared/51f06a50-5435-427a-aa8f-6fb311146a37.json
```
*(Paste isi JSON kredensial Anda, simpan, lalu set izin akses)*:
```bash
sudo chmod 600 /etc/cloudflared/*.json
sudo systemctl restart cloudflared-ricoh-api
```

#### Opsi B: Anda Membuat Tunnel Baru di Cloudflare Dashboard
Jika Tunnel lama ikut hilang di Cloudflare:
1. Buka [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) > **Networks** > **Tunnels**.
2. Klik **Create a Tunnel** (beri nama `ricoh-api-vps`).
3. Pilih environment **Debian 64-bit**, lalu salin **Connector Token**.
4. Di VPS baru, cukup jalankan konektor:
   ```bash
   sudo cloudflared service install <PASTE_CONNECTOR_TOKEN>
   ```
5. Di panel Cloudflare, tambahkan Public Hostname:
   - Subdomain: `api`
   - Domain: `tamammrbeast.my.id`
   - Type: `HTTP`
   - URL: `127.0.0.1:3000`

---

### 4. Pulihkan Data Whitelist (Opsional)
Jika Anda memiliki salinan file `whitelist.json` sebelumnya:
```bash
sudo cp /path/to/whitelist.json /home/ubuntu/GouangService/Database/whitelist.json
sudo chown ubuntu:ubuntu /home/ubuntu/GouangService/Database/whitelist.json
pm2 restart ricoh-shield-api
```
*Catatan: Jika tidak memiliki backup, sistem akan secara otomatis membuat database baru dengan pengaturan Global Key standar (`GLOBAL-FREE-2026`).*

---

### 5. Validasi Akhir
Jalankan healthcheck otomatis:
```bash
./deploy/healthcheck.sh all
```
Jika sukses, API Anda di `https://api.tamammrbeast.my.id` sudah kembali normal dan siap melayani Dashboard Vercel serta script Roblox `Initialize.lua`.
