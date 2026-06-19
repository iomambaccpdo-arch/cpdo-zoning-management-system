# CPDO Zoning System - Turnover Runbook

This document is for deploying and operating the system on a new office PC with minimal manual commands.

---

## 0) Before GitHub (for the person uploading the repo)

**Do commit to GitHub:**

- All source code (`client/`, `server/`, `scripts/`, this file)
- `server/.env.example` (template only — no real passwords)

**Do NOT commit:**

- `server/.env` (contains secrets — already in `server/.gitignore`)
- `client/.env` if you create one (in `client/.gitignore`)
- `server/vendor/`, `client/node_modules/`
- Uploaded PDFs under `server/storage/app/private/documents/`
- `server/storage/logs/*.log`

**Recommended:** Add a short root `README.md` on GitHub with the repo name and link to this `TURNOVER.md`.

---

## 1) Recommended Setup

- Use one stable machine as the host PC.
- Start services automatically on Windows log in.
- Access app via browser: `http://localhost:9000` on the host PC.
- Keep daily backups for database and uploaded files.

---

## 2) System Requirements (New PC)

- Windows 10/11 (64-bit)
- At least 8 GB RAM, SSD storage recommended
- Stable LAN connection (if other PCs will use the app later)
- Optional but recommended: UPS

---

## 3) Software to Install

Install in this order:

1. **Git**
2. **PHP 8.2+** (8.4 is fine) — enable extensions:
   - `pdo_pgsql` (required)
   - `pgsql` (recommended)
   - `openssl`, `mbstring`, `fileinfo`, `curl` (usually enabled)
3. **Composer 2.x**
4. **Node.js LTS** (includes npm)
5. **PostgreSQL 14+**
6. Optional: **pgAdmin** for database admin

Verify from PowerShell:

```powershell
git --version
php --version
php -m | findstr pdo_pgsql
composer --version
node --version
npm --version
psql --version
```

If `pdo_pgsql` does not appear, enable it in `php.ini` and restart any open terminals.

**PDF uploads:** The repo includes `server\php.ini` with higher upload limits. The provided `_start-laravel.bat` loads it automatically. If you edit upload sizes later, keep `post_max_size` ≥ total size of all files in one request.

---

## 4) Get the Project from GitHub

```powershell
cd C:\Apps
git clone <YOUR_GITHUB_REPO_URL> cpdo-zoning-management-system
cd cpdo-zoning-management-system
```

Use a stable local path (recommended):

`C:\Apps\cpdo-zoning-management-system`

Avoid running the live system from **OneDrive** or other sync folders (file locks during PDF upload).

---

## 5) Database Setup (PostgreSQL)

1. Start PostgreSQL (Windows service → **Automatic**).
2. Create an empty database named `server` (pgAdmin or SQL):

```sql
CREATE DATABASE server;
```

3. Set credentials (example):

| Setting  | Value              |
|----------|--------------------|
| DB name  | `server`           |
| Host     | `127.0.0.1`        |
| Port     | `5432`             |
| User     | `postgres` (or dedicated user) |
| Password | strong password    |

---

## 6) Backend Configuration (`server/.env`)

Copy the template and edit:

```powershell
cd C:\Apps\cpdo-zoning-management-system\server
copy .env.example .env
notepad .env
```

Minimum values to set:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=server
DB_USERNAME=postgres
DB_PASSWORD=<SET_STRONG_PASSWORD>

SESSION_DRIVER=database
SESSION_DOMAIN=localhost
SANCTUM_STATEFUL_DOMAINS=localhost:9000,127.0.0.1:9000,localhost:8000,127.0.0.1:8000
```

**Email / queue (optional for office use):** Routed emails use a queue. For simplicity on one PC, you can set:

```env
QUEUE_CONNECTION=sync
```

so emails send immediately without running `php artisan queue:work`. Default in `.env.example` is `database` (requires a queue worker).

---

## 7) Frontend API URL (optional)

The client defaults to `http://localhost:8000`. If the API runs elsewhere, create `client/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Restart the client dev server after changing this file.

---

## 8) First-Time Installation Commands

### Backend

```powershell
cd C:\Apps\cpdo-zoning-management-system\server
composer install
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link
```

**Important:** Always run `php artisan migrate --force` after pulling updates from GitHub (new columns such as `uploaded_by` on attachments).

### Frontend

```powershell
cd C:\Apps\cpdo-zoning-management-system\client
npm install
```

---

## 9) Default Login Accounts (after seeding)

Created by `php artisan db:seed`. **Change passwords after first login** in production.

| Role          | Email                   | Default password |
|---------------|-------------------------|------------------|
| Super Admin   | `superadmin@example.com` | `123456789`      |
| Coordinator   | `coordinator@example.com` | `123456789`   |
| Zoning Officer | `officer@example.com`  | `123456789`      |

(Additional seeded users may exist — check `RolesAndPermissionsSeeder.php`.)

---

## 10) Scripts (`scripts\`)

| Path | Purpose |
|------|---------|
| `For Opening the System\start-cpdo-system.bat` | Starts API (8000) + app (9000), opens browser |
| `For Opening the System\_start-laravel.bat` | Laravel only (loads `server\php.ini` for large PDF uploads) |
| `For Opening the System\_start-client.bat` | Frontend only |
| `For Opening the System\register-autostart.ps1` | Startup shortcut (runs on user log in) |
| `For Opening the System\unregister-autostart.ps1` | Removes Startup shortcut |
| `Export\export-sync-package.bat` | **Office PC:** dump DB + PDFs to USB |
| `Import\import-sync-package.bat` | **DH laptop:** load USB package into local app |
| `sync-config.example.ps1` | Copy to `sync-config.ps1` (see §12.5) |
| `sync-common.ps1` | Shared helpers (do not run directly) |
| `check-database.bat` | **Any PC:** test PostgreSQL, `.env`, tables, login accounts |
| `register-monthly-export.ps1` | **Office PC:** optional scheduled export |

**Prerequisites:** PostgreSQL running; `php` and `npm` on PATH (or edit `_start-*.bat` with full paths).

### Manual test

Double-click:

`C:\Apps\cpdo-zoning-management-system\scripts\For Opening the System\start-cpdo-system.bat`

Expected:

- API: `http://127.0.0.1:8000`
- App: `http://localhost:9000`

### Auto-start on login (run once)

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Apps\cpdo-zoning-management-system\scripts\For Opening the System\register-autostart.ps1"
```

If the project folder moves, run `register-autostart.ps1` again.

---

## 11) File Storage Locations

| What | Path |
|------|------|
| Project source | `C:\Apps\cpdo-zoning-management-system` |
| PDF attachments | `server\storage\app\private\documents\` (subfolders `YYYY\MM\{document_id}\`) |
| Laravel logs | `server\storage\logs\laravel.log` |
| Database files | PostgreSQL data directory (not in project) |

One **document** record can have **many PDF attachments** over time (Dashboard → month table → **Manage Attachments**).

---

## 12) Backup Plan (Required)

Daily:

1. **PostgreSQL dump** (example):

```powershell
pg_dump -U postgres -h 127.0.0.1 -F c -f "D:\Backups\cpdo\server_%date%.backup" server
```

2. **Copy folder:** `server\storage\app\private\documents\`

Retention: at least 30 days; keep one copy off the PC (external drive/NAS).

**Restore test:** At least once per quarter, restore dump + files to a test folder and confirm login and one PDF open.

---

## 12.5) Sync Office PC → Department Head Laptop

Use this when **both PCs already have the app installed**, but only the **office PC** has live data. The Department Head (DH) laptop gets a **snapshot** (not live over the network). Each export/import cycle copies the database and all PDF attachments.

### How it works

```text
Office PC                              USB (e.g. E:\cpdo-sync)              DH laptop
─────────                              ───────────────────────              ─────────
Daily use → localhost:9000           package\                             After import → localhost:9000
       │                               ├─ server.backup                     (same logins as office)
       │  Export\export-sync-package.bat ├─ documents\
       └──────────────────────────────►└─ MANIFEST.json ──► Import\import-sync-package.bat
```

**Office PC = source of truth.** Edits on the DH laptop stay on his laptop unless you deliberately export from his PC back to the office (not recommended).

---

### One-time setup (both PCs)

1. Pull latest code from GitHub (`git pull`) so `scripts\Export\`, `scripts\Import\`, and `scripts\sync-common.ps1` exist.
2. On **each** PC, create local config (this file is **not** in GitHub):

```powershell
cd C:\Apps\cpdo-zoning-management-system\scripts
copy sync-config.example.ps1 sync-config.ps1
notepad sync-config.ps1
```

3. Set `$SyncFolder` to where the USB package lives, for example:

```powershell
$SyncFolder = "E:\cpdo-sync"
```

- **Office PC:** create only `E:\cpdo-sync` on the USB. The export script creates `E:\cpdo-sync\package\` automatically.
- **DH laptop:** use the **same drive letter** if he plugs in the same USB (`E:\cpdo-sync`). If he copies the folder to disk, set `$SyncFolder` to that path (e.g. `D:\cpdo-sync`).
4. On the **DH laptop**, `server\.env` must use:
   - `DB_DATABASE=server`
   - `DB_USERNAME` / `DB_PASSWORD` for **PostgreSQL installed on the DH laptop** (the password you set when installing Postgres on that PC)
   - You do **not** copy the office PC's Postgres password unless you used the same password on both machines
5. The DH laptop does **not** use the office database over the network. Data comes only from **USB import** (`import-sync-package.bat`) after the office runs export.

---

### Office PC — export (coworker)

**When:** Monthly, or whenever the DH wants fresh data.

| Step | Action |
|------|--------|
| 1 | Plug in USB. Confirm it is drive **E:** (or whatever you set in `sync-config.ps1`). |
| 2 | Ensure PostgreSQL is running. |
| 3 | Double-click `scripts\Export\export-sync-package.bat`. |
| 4 | Wait for **Export finished.** |
| 5 | In File Explorer, confirm `E:\cpdo-sync\package\` contains `server.backup`, `documents\`, and `MANIFEST.json`. |
| 6 | Safely eject USB and give it to the Department Head. |

**Troubleshooting export**

| Error | Fix |
|-------|-----|
| Missing `sync-config.ps1` | Copy from `sync-config.example.ps1` into `scripts\` (not `scripts\Export\`). |
| Red PowerShell parse errors | Pull latest repo; re-run the `.bat` file. |
| `pg_dump` not found | Install PostgreSQL or add its `bin` folder to PATH. |
| `pg_dump failed` | Start PostgreSQL; check `DB_PASSWORD` in `server\.env`. |

---

### DH laptop — import (Department Head)

**Prerequisites:** App already installed (§§3–10). USB package from office PC.

| Step | Action |
|------|--------|
| 1 | Plug in USB (same letter as in `sync-config.ps1`, e.g. `E:\cpdo-sync`). |
| 2 | Confirm `E:\cpdo-sync\package\server.backup` exists. |
| 3 | **Close** all CPDO app windows (Laravel + frontend). |
| 4 | Double-click `scripts\Import\import-sync-package.bat`. |
| 5 | Type **`YES`** and press Enter. |
| 6 | Wait for **Import finished.** |
| 7 | Double-click `scripts\For Opening the System\start-cpdo-system.bat`. |
| 8 | Open `http://localhost:9000` — log in with the **same accounts** as the office PC. |
| 9 | Spot-check: Dashboard loads; open one PDF. |

**Troubleshooting import**

| Error | Fix |
|-------|-----|
| Missing backup file | Run export on office PC first; check `$SyncFolder` matches USB path. |
| `pg_restore failed` | PostgreSQL running; matching password in `server\.env`; retry after `DROP DATABASE server; CREATE DATABASE server;` in pgAdmin. |
| Login OK but PDF blank | Re-import; ensure `documents\` was on the USB. |

### DH laptop: database / login not working (office PC works)

The DH laptop has its **own** PostgreSQL on `127.0.0.1`. The app will not see office data until import succeeds.

| Symptom | What to do |
|---------|------------|
| `could not find driver` | On DH laptop: enable `pdo_pgsql` in `php.ini` (§3), restart API. |
| `SQLSTATE[08006]` / connection refused | Start PostgreSQL service (Automatic). Run `scripts\check-database.bat`. |
| Wrong password / authentication failed | Edit `server\.env` on the **DH laptop** — `DB_PASSWORD` must match **that laptop's** Postgres user, not the office PC. |
| Login fails / "credentials" error | Empty database: run `import-sync-package.bat` after office export. Or run `php artisan db:seed --force` only for a test empty system. |
| Dashboard empty but login works | Import not run or failed — re-export on office, re-import on DH. |
| Same error as office ("Post Data is too Large") | Use `start-cpdo-system.bat` (loads `server\php.ini`) — see §15. |

**DH laptop checklist (in order):**

1. PostgreSQL installed and service **Running**.
2. `server\.env` exists with correct `DB_PASSWORD` for **this** PC.
3. Run `scripts\check-database.bat` — fix every **FAIL** line.
4. USB plugged in; `sync-config.ps1` points to `package\server.backup`.
5. Close app windows → `Import\import-sync-package.bat` → type `YES`.
6. Run `check-database.bat` again (should show users and tables).
7. `start-cpdo-system.bat` → `http://localhost:9000`.

**Reset DH database and import again (pgAdmin):**

```sql
DROP DATABASE server;
CREATE DATABASE server;
```

Then run `import-sync-package.bat` again.

---

### Repeat each month

1. Office: `Export\export-sync-package.bat`  
2. Hand off USB  
3. DH: `Import\import-sync-package.bat` → start app  

Data on the DH laptop matches the office PC **as of the export time** only.

---

### Optional: auto-export on office PC

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Apps\cpdo-zoning-management-system\scripts\register-monthly-export.ps1"
```

Runs export every 4 weeks (Friday 6 PM). USB drive letter in `sync-config.ps1` must be connected. Adjust timing in **Task Scheduler** → task name `CPDO Export Sync Package`.

---

## 13) Updating After `git pull`

When the repo is updated on GitHub:

```powershell
cd C:\Apps\cpdo-zoning-management-system
git pull

cd server
composer install
php artisan migrate --force

cd ..\client
npm install
```

Restart using `scripts\For Opening the System\start-cpdo-system.bat` (or reboot if auto-start is enabled).

---

## 14) Basic Acceptance Test Checklist

- [ ] PostgreSQL service running
- [ ] Login works (seeded account)
- [ ] Dashboard loads (month counts, Recent Files)
- [ ] Create document with PDF upload
- [ ] Month documents table: **Edit**, **Manage Attachments**, **Download**, **Delete**
- [ ] Recent Files: **Preview** only
- [ ] Manage Attachments: upload extra PDF, preview, download, delete
- [ ] Data persists after PC reboot (with auto-start enabled)

---

## 15) Troubleshooting

### `could not find driver` / DB connection error

- Enable `pdo_pgsql` in `php.ini`
- Confirm PostgreSQL is running
- Verify `server/.env` DB name, user, password
- Run `scripts\check-database.bat` on the PC that fails (office vs DH — each has its own Postgres and `.env`)
- **DH laptop:** you must import office data via USB (§12.5); fixing `.env` alone does not copy documents or users from the office PC

### `Failed to create document` / HTTP 500 on upload

- Run: `php artisan migrate --force` (missing columns e.g. `uploaded_by`)
- Check `server\storage\logs\laravel.log` for the exact error

### `Post Data is too Large` (PDF upload / create document)

This is **not a PostgreSQL error**. PHP rejects the HTTP request when the total upload (all PDFs + form fields) exceeds `post_max_size` (often **8M** by default).

**Fix (recommended — use the project start script):**

1. Always start the API with `scripts\For Opening the System\start-cpdo-system.bat` (or `_start-laravel.bat`). These run PHP with `server\php.ini` (`post_max_size=128M`, `upload_max_filesize=64M`).
2. Close any old “CPDO Laravel API” terminal windows, then start again so the new limits apply.

**If you start Laravel manually** (`php artisan serve` without `-c`), you must either:

```powershell
cd C:\Apps\cpdo-zoning-management-system\server
php -c php.ini artisan serve --host=0.0.0.0 --port=8000
```

**or** edit the system `php.ini` used by CLI (find path with `php --ini`), set at least:

```ini
post_max_size = 128M
upload_max_filesize = 64M
max_file_uploads = 50
```

`post_max_size` must be **larger than the combined size** of every PDF in one submit plus the form fields. Restart the API after changing `php.ini`.

**Verify active limits:**

```powershell
cd C:\Apps\cpdo-zoning-management-system\server
php -c php.ini -r "echo 'post_max_size=' . ini_get('post_max_size') . PHP_EOL . 'upload_max_filesize=' . ini_get('upload_max_filesize');"
```

Expected: `post_max_size=128M` and `upload_max_filesize=64M`.

**App limits:** Each PDF may be up to **64 MB**; up to **20 PDFs** per request (see `server/config/uploads.php` and optional `UPLOAD_MAX_FILE_MB` in `.env`).

### `php` or `npm` not recognized

- Reinstall or add to PATH
- Or set full paths in `scripts\For Opening the System\_start-laravel.bat` and `_start-client.bat`

### Port already in use (8000 / 9000)

- Close old terminal windows or reboot
- Run `scripts\For Opening the System\start-cpdo-system.bat` again

### PDF preview blank / 401

- Log in first in the same browser
- API must be `http://127.0.0.1:8000` (match `VITE_API_URL` and CORS in `server/config/cors.php`)

### Auto-start does not run

- Re-run `register-autostart.ps1`
- Same Windows user must log in (Startup is per-user, not before login screen)

### Emails not sent when routing documents

- Set `QUEUE_CONNECTION=sync` in `.env`, **or**
- Run `php artisan queue:work` in a separate terminal while the app is in use

---

## 16) Turnover Checklist (Sign-Off)

- [ ] Repo on GitHub; `.env` not committed
- [ ] Coworker has GitHub access
- [ ] Dependencies installed (PHP + pdo_pgsql, Composer, Node, PostgreSQL)
- [ ] `server/.env` configured (passwords stored securely)
- [ ] `migrate` + `db:seed` completed
- [ ] Manual startup test passed
- [ ] Auto-start enabled and tested after reboot
- [ ] Backup job configured + one restore test done
- [ ] Sync export/import tested once (§12.5) if DH uses a laptop copy
- [ ] Default passwords changed
- [ ] This runbook handed over

---

## 17) Important Notes

- Prefer `C:\Apps\...` over OneDrive for the live install.
- Never put real passwords in GitHub or printed runbooks.
- Moving the project folder requires re-running `register-autostart.ps1`.
- For multiple office PCs sharing one database, use one **server PC** and browse to its IP (LAN setup — not covered in detail here).
