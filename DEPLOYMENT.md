# Bukadita Backend - Vercel Deployment Guide

## 📋 Prerequisites

- Vercel Account
- Supabase Project
- Node.js 18.x or higher

## 🚀 Deployment Steps

### 1. Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 2. Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

#### Required Variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-frontend.vercel.app
```

#### Optional Variables:

```env
JWT_SECRET=your_random_32_char_secret
DATABASE_URL=postgresql://...
```

### 3. Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub/GitLab repository
4. Select **"be-bukadita"** folder as root directory
5. **Framework Preset**: Other
6. **Build Command**: (leave empty or `npm install`)
7. **Output Directory**: (leave empty)
8. **Install Command**: `npm install`
9. Add all environment variables
10. Click **"Deploy"**

### 4. Deploy via CLI

```bash
cd be-bukadita
vercel
# Follow prompts
# Select "be-bukadita" as root
# Add environment variables when prompted
```

### 5. Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS settings

## 🔒 Security Checklist

- [x] CORS configured with specific origins
- [x] Helmet.js for security headers
- [x] Environment variables in Vercel (not in code)
- [x] Rate limiting (if implemented)
- [x] Input validation with Joi
- [x] Supabase RLS policies enabled
- [x] Authentication middleware on protected routes
- [x] File upload size limits (5MB)

## 📝 Vercel Configuration

The project includes `vercel.json` with:

- Node.js runtime configuration
- Route handling for all API endpoints
- Singapore region (sin1) for better latency in Asia

## 🧪 Testing Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://your-backend.vercel.app/health

# API endpoints
curl https://your-backend.vercel.app/api/v1/modules
```

## 🐛 Troubleshooting

### CORS Issues

- Check `FRONTEND_URL` environment variable
- Verify origin in browser DevTools
- Check Vercel logs for CORS warnings

### Environment Variables Not Loading

- Ensure variables are set in Vercel Dashboard
- Redeploy after adding variables
- Check variable names (case-sensitive)

### 500 Internal Server Error

- Check Vercel Function Logs
- Verify Supabase credentials
- Check database connection

### File Upload Issues

- Vercel has 50MB request limit
- Adjust file size limits if needed
- Consider using direct Supabase Storage upload

## 📊 Monitoring

- **Logs**: Vercel Dashboard → Deployment → Function Logs
- **Analytics**: Vercel Dashboard → Analytics
- **Performance**: Monitor response times in logs

## 🔄 Auto-Deploy

Vercel automatically deploys on:

- Push to `main` branch (production)
- Push to other branches (preview)
- Pull requests (preview)

Configure in: Settings → Git

## 💰 Pricing Notes

Vercel Free Tier includes:

- 100GB bandwidth/month
- 100GB-hours serverless function execution
- Unlimited preview deployments

For production, consider Pro plan for:

- Better performance
- Higher limits
- Team collaboration

## 🆘 Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)
- [Supabase Docs](https://supabase.com/docs)
