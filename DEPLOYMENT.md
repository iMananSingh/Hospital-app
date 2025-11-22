# HMSync Deployment Guide - Fly.io

This guide will walk you through deploying your HMSync Hospital Management System to Fly.io with persistent SQLite storage and custom domain support.

## Prerequisites

1. **Fly.io Account**: Sign up at https://fly.io/app/sign-up
2. **Fly.io CLI**: Install the CLI tool
3. **Credit Card**: Required for Fly.io (but stays within free tier for this app)

### Install Fly.io CLI

**macOS/Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```powershell
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Verify installation:**
```bash
fly version
```

---

## Step 1: Prepare Your Application

### 1.1 Set Production JWT Secret

For security, set a strong JWT secret for production:

```bash
# Generate a random secret (run this locally)
openssl rand -base64 32
```

Save this secret - you'll need it in Step 3.

### 1.2 Test Local Build (Optional but Recommended)

```bash
npm run build
```

This should create:
- `dist/public/` - Frontend assets
- `dist/index.js` - Backend bundle

---

## Step 2: Deploy to Fly.io

### 2.1 Login to Fly.io

```bash
fly auth login
```

This will open your browser for authentication.

### 2.2 Launch Your Application

Navigate to your project directory and run:

```bash
fly launch
```

The CLI will detect your `fly.toml` configuration and ask:
- **App name**: Press Enter to use `hmsync` or choose your own
- **Region**: Choose closest to your users (e.g., `iad` for US East)
- **Create PostgreSQL database?**: **NO** (we're using SQLite)
- **Create Redis database?**: **NO**

### 2.3 Create Persistent Volume for SQLite

Your database needs persistent storage:

```bash
fly volumes create hmsync_data --region iad --size 3
```

**Important**: The volume name `hmsync_data` matches the mount in `fly.toml`. The region must match your app's region.

### 2.4 Set Environment Variables

Set your production JWT secret:

```bash
fly secrets set JWT_SECRET="your-generated-secret-from-step-1"
```

### 2.5 Deploy the Application

```bash
fly deploy
```

This will:
1. Build your Docker image
2. Push it to Fly.io's registry
3. Deploy to their infrastructure
4. Start your application

Watch the deployment logs. Once complete, you'll see:
```
Visit your newly deployed app at https://hmsync.fly.dev/
```

---

## Step 3: Verify Deployment

### 3.1 Check Application Status

```bash
fly status
```

### 3.2 View Logs

```bash
fly logs
```

### 3.3 Test Health Endpoint

```bash
curl https://hmsync.fly.dev/api/health
```

You should see:
```json
{"status":"ok","timestamp":"2025-01-..."}
```

### 3.4 Access Your Application

Open https://hmsync.fly.dev in your browser. You should see the login page.

**Default credentials:**
- Username: `admin`
- Password: (check your database initialization in `server/storage.ts`)

---

## Step 4: Custom Domain Setup

### 4.1 Get Your App's IP Addresses

```bash
fly ips list
```

Output example:
```
VERSION IP                    TYPE   REGION
v4      66.241.124.123        public global
v6      2a09:8280:1::a1:b2c3  public global
```

### 4.2 Configure DNS Records

At your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.), add these DNS records:

**For Apex Domain (example.com):**

| Type  | Host/Name | Value              | TTL  |
|-------|-----------|-------------------|------|
| A     | @         | `66.241.124.123`  | Auto |
| AAAA  | @         | `2a09:8280:1::a1:b2c3` | Auto |

**For www Subdomain:**

| Type  | Host/Name | Value           | TTL  |
|-------|-----------|----------------|------|
| CNAME | www       | `hmsync.fly.dev` | Auto |

Replace the IPs with your actual IPs from `fly ips list`.

### 4.3 Add SSL Certificate

Once DNS is configured (wait 5-10 minutes for propagation):

```bash
# For apex domain
fly certs add yourdomain.com

# For www subdomain
fly certs add www.yourdomain.com
```

### 4.4 Check Certificate Status

```bash
fly certs show yourdomain.com
```

Wait until status shows `Ready`. This can take 5-60 minutes.

### 4.5 Verify Custom Domain

Visit `https://yourdomain.com` in your browser. Your HMSync app should load with a valid SSL certificate!

---

## Step 5: Maintenance & Monitoring

### View Application Logs

```bash
fly logs
```

### SSH Into Your App

```bash
fly ssh console
```

### Check Database

```bash
fly ssh console
ls -lh /app/data/
```

### Scale Resources (if needed)

The current configuration uses 512MB RAM. To increase:

```bash
fly scale memory 1024
```

### Update Application

After making code changes:

```bash
fly deploy
```

---

## Cost Breakdown

### Free Tier Coverage

Your HMSync deployment will likely stay **completely free** under Fly.io's $10/month allowance:

- **VM (512MB, shared CPU)**: ~$3.19/month
- **Volume (3GB)**: ~$0.45/month
- **Bandwidth**: Minimal for 5 users
- **Total**: ~$3.64/month → **Covered by free allowance**

### Monitoring Costs

```bash
fly dashboard
```

View usage at: https://fly.io/dashboard/[your-org]/billing

---

## Troubleshooting

### App Not Starting

Check logs:
```bash
fly logs
```

Common issues:
- Missing `JWT_SECRET`: Set it with `fly secrets set`
- Build errors: Run `npm run build` locally to test

### Database Issues

Check volume mount:
```bash
fly ssh console
ls -la /app/data/
```

### SSL Certificate Not Ready

- Ensure DNS records point to correct IPs
- Wait up to 1 hour for propagation
- Check status: `fly certs show yourdomain.com`

### Port Issues

Fly.io requires apps to bind to `0.0.0.0:8080` (set via `PORT` env var). This is configured in:
- `fly.toml` → `internal_port = 8080`
- `server/index.ts` → Uses `process.env.PORT`

---

## Backup Strategy

### Manual Database Backup

```bash
fly ssh console
cd /app/data
cat hospital.db > /tmp/backup.db
exit

fly ssh sftp shell
get /tmp/backup.db ./hospital-backup-$(date +%Y%m%d).db
```

### Automated Backups

Your app includes a backup scheduler (`server/backup-scheduler.ts`). Backups are stored in `/app/data/backups/`.

To download backups:
```bash
fly ssh console
ls -lh /app/data/backups/
```

---

## Security Recommendations

1. **Change default admin password** immediately after first login
2. **Use strong JWT_SECRET** (32+ random characters)
3. **Enable Fly.io's firewall** if needed (already configured for HTTPS)
4. **Regular backups** - Download database backups weekly

---

## Support & Resources

- **Fly.io Docs**: https://fly.io/docs/
- **Fly.io Community**: https://community.fly.io/
- **Status Page**: https://status.fly.io/

---

## Quick Reference Commands

```bash
# Deploy updates
fly deploy

# View logs
fly logs

# Check status
fly status

# SSH into app
fly ssh console

# Scale memory
fly scale memory 1024

# View app info
fly info

# Open dashboard
fly dashboard
```

---

## Next Steps

1. ✅ Login to your deployed app
2. ✅ Change admin password
3. ✅ Create user accounts for your hospital staff
4. ✅ Configure system settings (hospital name, logo, etc.)
5. ✅ Start managing patients, doctors, and services!

Your HMSync Hospital Management System is now live and ready for production use! 🎉
