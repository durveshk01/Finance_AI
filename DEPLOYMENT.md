# FinanceIQ Deployment Guide

This guide covers local setup, GitHub workflow, Vercel preview deployments, production deployment, and post-deployment checks.

## 1. Local Setup

```bash
cd "C:\New folder\financeiq"
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## 2. GitHub Push

Do not push directly to `main` for final review work. Use a preview branch:

```bash
cd "C:\New folder\financeiq"
git status
git switch -c resume-ready-polish
git add .
git commit -m "Make FinanceIQ resume ready"
git push -u origin resume-ready-polish
```

Open a pull request from `resume-ready-polish` into `main`.

## 3. Vercel Import

1. Go to https://vercel.com.
2. Sign in with GitHub.
3. Click **Add New...**.
4. Click **Project**.
5. Select the FinanceIQ repository.
6. Click **Import**.

## 4. Environment Variables

In Vercel, open **Project Settings** -> **Environment Variables** and add:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_APP_URL=https://your-vercel-url.vercel.app
NEXT_PUBLIC_SITE_NAME=FinanceIQ
NEXT_PUBLIC_ANALYTICS_ENABLED=false
```

Keep `OPENAI_API_KEY` server-side only. Do not prefix it with `NEXT_PUBLIC_`.

## 5. Build Settings

Vercel should auto-detect Next.js.

- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `.next`
- Node.js Version: 20 or newer

## 6. Preview Deployment Workflow

1. Push the `resume-ready-polish` branch.
2. Open the pull request on GitHub.
3. Wait for Vercel to create a Preview Deployment.
4. Open the preview URL.
5. Test upload, demo mode, dashboard tabs, chatbot, exports, and mobile layout.
6. Fix issues on the branch and push again.

## 7. Production Deployment Workflow

Only merge after preview approval:

```bash
git switch main
git pull origin main
git merge resume-ready-polish
git push origin main
```

Vercel will deploy the production branch automatically if configured.

## 8. Post-Deployment Checklist

- Website loads over HTTPS.
- Demo mode works.
- Upload validation works.
- CSV upload returns a report.
- Dashboard tabs work.
- Chatbot works with demo data and uploaded reports.
- CSV, XLSX, PDF, and JSON exports download.
- Environment variables are configured.
- Browser console has no runtime errors.
- Mobile layout is usable.
- README and privacy/security docs are current.
