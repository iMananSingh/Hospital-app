# HMSync Deployment Guide for Fly.io

This guide will help you deploy your HMSync Hospital Management System to Fly.io with persistent SQLite database storage.

## Prerequisites

1. **Install Fly CLI**
   ```bash
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh
   
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Create Fly.io Account** (if you don't have one)
   ```bash
   fly auth signup
   ```
   
   Or login if you already have an account:
   ```bash
   fly auth login
   ```

## Cost Breakdown

### Free Tier (what you get for free):
- 3 shared-cpu-1x VMs (256MB RAM) - **You'll use 1 VM**
- 160GB outbound data transfer per month
- **Total monthly cost with 1GB volume: ~$0.15/month** (just the volume)

### What you're deploying:
- 1 VM (shared-cpu-1x, 256MB) - **FREE**
- 1GB volume for database - **$0.15/month**
- **Total: $0.15/month**

If you need more storage later:
- 10GB volume = $1.50/month
- 50GB volume = $7.50/month

## Deployment Steps

### 1. Update App Name (Optional)

Edit `fly.toml` and change the app name if you want:
```toml
app = 'your-custom-name'  # Change from 'hmsync' to your preferred name
```

Also update the region if needed (default is Singapore 'sin'):
```toml
primary_region = 'sin'  # Options: sin, syd, hkg, nrt, lhr, fra, ams, etc.
```

### 2. Launch Your App

From your project directory, run:
```bash
fly launch --no-deploy
```

This will:
- Ask you to confirm the app name
- Detect your Dockerfile
- Ask if you want to tweak settings (say NO, everything is configured)
- Create the app on Fly.io

### 3. Create Volume for Database Storage

Create a 1GB volume (costs $0.15/month):
```bash
fly volumes create hmsync_data --size 1 --region sin
```

> **Important**: The region must match your `primary_region` in fly.toml

### 4. Set Environment Variables

Set your session secret (generate a random secure string):
```bash
fly secrets set SESSION_SECRET="your-super-secret-random-string-here"
```

You can generate a random secret with:
```bash
# On macOS/Linux
openssl rand -base64 32

# On Windows (PowerShell)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

### 5. Deploy Your Application

```bash
fly deploy
```

This will:
- Build your Docker image
- Upload it to Fly.io
- Start your application
- Database will be created at `/data/hospital.db` on the volume

### 6. Access Your Application

Your app will be available at: `https://your-app-name.fly.dev`

Check your app status:
```bash
fly status
```

View logs:
```bash
fly logs
```

Open your app in browser:
```bash
fly open
```

## Important Notes

### Database Persistence
- Your SQLite database is stored on the volume at `/data/hospital.db`
- **Volume data persists across deployments and restarts**
- The database will be automatically initialized on first run
- **Always back up your data regularly** (volume failures can happen)

### Backups
Your app has automatic daily backups at 3:41 PM (configured in code). To manually access the database:

```bash
# SSH into your VM
fly ssh console

# Once inside, your database is at:
ls -lh /data/hospital.db

# To backup manually, you can copy it:
sqlite3 /data/hospital.db .dump > backup.sql
```

### Scaling

If you need more resources later:

**Increase RAM:**
```bash
fly scale memory 512  # or 1024, 2048, etc.
```

**Increase storage:**
```bash
fly volumes extend hmsync_data --size 10  # Extend to 10GB
```

**Add more VMs (for high availability):**
```bash
fly scale count 2  # Run 2 instances
```
> Note: SQLite doesn't support multiple writers, so if you add more VMs, you'll need to migrate to PostgreSQL

### Monitoring

View your app metrics:
```bash
fly dashboard
```

This opens a web dashboard showing:
- Request rates
- Response times
- Memory/CPU usage
- Geographic distribution

## Troubleshooting

### App won't start?
Check logs:
```bash
fly logs
```

### Database issues?
SSH into your VM and check:
```bash
fly ssh console
ls -lh /data/
```

### Out of memory?
Upgrade to 512MB:
```bash
fly scale memory 512
```

### Need to restart?
```bash
fly apps restart
```

## Updating Your Application

When you make changes and want to deploy:

```bash
# 1. Commit your changes (optional but recommended)
git add .
git commit -m "Your update message"

# 2. Deploy
fly deploy
```

Your volume data (database) will persist across deployments!

## Destroying Your App (if needed)

To completely remove your app and volume:

```bash
# Delete the app
fly apps destroy your-app-name

# This will also ask if you want to delete the volume
```

## Support

- Fly.io Docs: https://fly.io/docs/
- Community Forum: https://community.fly.io/
- HMSync Issues: (Your GitHub repo or support channel)

---

**You're all set! Your HMSync hospital management system is now running on Fly.io with persistent data storage for just $0.15/month.** 🚀
