# Hospital Database Backup Guide

This guide explains how to backup and download your `hospital.db` database from the Fly.io production server.

## Quick Backup (3 Steps)

### Step 1: Connect via SSH
Open PowerShell and run:

```powershell
fly ssh console -a hmsync-newhch-mandla
```

You'll be inside the Fly.io machine. You should see a terminal prompt.

### Step 2: Copy Database to Download Location
Inside the SSH terminal, run:

```bash
cp /data/hospital.db /tmp/hospital.db
```

Verify it was copied:

```bash
ls -lh /tmp/hospital.db
```

You should see something like:
```
-rw-r--r-- 1 root root 1.2M Nov 22 22:30 /tmp/hospital.db
```

Exit SSH:

```bash
exit
```

### Step 3: Download to Your Computer
Back in PowerShell, run:

```powershell
fly ssh sftp get -a hmsync-newhch-mandla /tmp/hospital.db ./hospital.db
```

Your database file `hospital.db` is now in your current directory.

---

## What's Stored in hospital.db?

The database contains:
- ✅ All patient records
- ✅ All billing/invoices
- ✅ All doctor records
- ✅ All OPD visits
- ✅ Pathology tests
- ✅ User accounts and roles
- ✅ Audit logs
- ✅ Settings and configurations

## Data Safety

Your database is stored on a **persistent Fly.io volume** that:
- ✅ Survives app restarts
- ✅ Survives machine reboots
- ✅ Survives deployments
- ✅ Persists indefinitely

## Restore Instructions

To restore a backup:

1. **Connect via SSH** (same as above)
2. **Replace the database**:
   ```bash
   fly ssh sftp put -a hmsync-newhch-mandla ./hospital.db.backup /data/hospital.db
   ```
3. **Restart the app**:
   ```powershell
   fly machines restart <MACHINE_ID> -a hmsync-newhch-mandla
   ```

---

## Automated Backups (Optional)

To regularly backup your database to a separate location, create a scheduled script using your local task scheduler or cron job:

```powershell
# Example PowerShell backup script (save as backup.ps1)
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
fly ssh sftp get -a hmsync-newhch-mandla /tmp/hospital.db "./backups/hospital_$timestamp.db"
```

Run this script daily/weekly for automatic backups.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| SSH connection fails | Make sure flyctl is installed and you're logged in: `fly auth login` |
| SFTP get fails | File might not exist on machine. Verify with `ls -lh /tmp/hospital.db` in SSH |
| File is large | Normal - database can grow as you add more data |
| Want to backup while app is running | Safe to do - Fly.io handles concurrent access |

---

## Questions?

Check the Fly.io documentation:
- https://fly.io/docs/flyctl/ssh/
- https://fly.io/docs/postgres/backup-restore/
