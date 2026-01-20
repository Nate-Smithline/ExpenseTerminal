# Quick Public Deployment Guide

## Option 1: Vercel (Fastest - ~2 minutes)

The easiest way to get your site live quickly:

1. **Push your code to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure the project:
     - **Root Directory**: `apps/frontend`
     - **Framework Preset**: Next.js (auto-detected)
     - **Build Command**: `cd ../.. && pnpm install && pnpm build --filter=@ledgerterminal/frontend`
     - **Output Directory**: `.next` (default)
     - **Install Command**: `cd ../.. && pnpm install`
   - Click "Deploy"

3. **That's it!** Vercel will give you a URL like `https://your-project.vercel.app`

Your site will auto-deploy on every push to your main branch.

---

## Option 2: Railway (Matches Your Stack)

Since you're planning to use Railway for production:

1. **Install Railway CLI**:
   ```bash
   brew install railway
   railway login
   ```

2. **Initialize Railway project**:
   ```bash
   cd apps/frontend
   railway init
   ```

3. **Configure build**:
   - Railway will auto-detect Next.js
   - Set **Root Directory** to `/apps/frontend` in Railway dashboard
   - Set build command: `cd ../.. && pnpm install && pnpm build --filter=@ledgerterminal/frontend`

4. **Deploy**:
   ```bash
   railway up
   ```

5. **Get your URL**: Railway will provide a `*.railway.app` URL

---

## Option 3: Netlify (Also Free & Fast)

1. Push to GitHub (same as Vercel step 1)

2. Go to [netlify.com](https://netlify.com) and sign in with GitHub

3. Click "Add new site" → "Import an existing project"

4. Select your repository

5. Configure:
   - **Base directory**: `apps/frontend`
   - **Build command**: `cd ../.. && pnpm install && pnpm build --filter=@ledgerterminal/frontend`
   - **Publish directory**: `apps/frontend/.next`

6. Click "Deploy"

---

## Troubleshooting

### Build fails with "pnpm: command not found"
- Vercel/Netlify: Make sure your build command includes `npm install -g pnpm` first, or use the `installCommand` option
- Railway: Should auto-detect pnpm, but you can add a `package.json` script

### Monorepo not building correctly
- Make sure the **root directory** is set correctly (should be the repo root)
- The build command should run from root: `cd ../..` if starting from `apps/frontend`

---

## Quick Local Test

Before deploying, test locally:
```bash
cd apps/frontend
pnpm dev
# Visit http://localhost:3000
```

You should see a white page with "hello" in the center.
