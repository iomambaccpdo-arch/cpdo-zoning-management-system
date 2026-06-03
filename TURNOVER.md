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

## 10) Startup Scripts (`scripts\`)

| File | Purpose |
|------|---------|
| `start-cpdo-system.bat` | Starts API (8000) + app (9000), opens browser |
| `_start-laravel.bat` | Laravel only |
| `_start-client.bat` | Frontend only |
| `register-autostart.ps1` | Shortcut in Windows Startup (runs on user log in) |
| `unregister-autostart.ps1` | Removes Startup shortcut |

**Prerequisites before using scripts:** PostgreSQL running; `php` and `npm` on PATH (or edit the `_start-*.bat` files with full paths).

### Manual test

Double-click:

`C:\Apps\cpdo-zoning-management-system\scripts\start-cpdo-system.bat`

Expected:

- API: `http://127.0.0.1:8000`
- App: `http://localhost:9000`

### Auto-start on login (run once)

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Apps\cpdo-zoning-management-system\scripts\register-autostart.ps1"
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

Restart using `scripts\start-cpdo-system.bat` (or reboot if auto-start is enabled).

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

### `Failed to create document` / HTTP 500 on upload

- Run: `php artisan migrate --force` (missing columns e.g. `uploaded_by`)
- Check `server\storage\logs\laravel.log` for the exact error

### `php` or `npm` not recognized

- Reinstall or add to PATH
- Or set full paths in `scripts\_start-laravel.bat` and `_start-client.bat`

### Port already in use (8000 / 9000)

- Close old terminal windows or reboot
- Run `start-cpdo-system.bat` again

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
- [ ] Default passwords changed
- [ ] This runbook handed over

---

## 17) Important Notes

- Prefer `C:\Apps\...` over OneDrive for the live install.
- Never put real passwords in GitHub or printed runbooks.
- Moving the project folder requires re-running `register-autostart.ps1`.
- For multiple office PCs sharing one database, use one **server PC** and browse to its IP (LAN setup — not covered in detail here).
