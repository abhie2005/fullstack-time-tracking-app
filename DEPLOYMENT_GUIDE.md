# Deployment Guide - Clock In/Out System

This guide will help you deploy your full-stack application so others can access it online.

## Deployment Options

### Option 1: Free Tier Deployment (Recommended for beginners)
- **Frontend**: Vercel or Netlify (free, easy)
- **Backend**: Render or Railway (free tier available)
- **Database**: Keep SQLite or migrate to PostgreSQL (free on Render/Railway)

### Option 2: All-in-One Platform
- **Railway** or **Render**: Deploy both frontend and backend together
- **Fly.io**: Good for full-stack apps

---

## Recommended: Deploy to Render (Backend) + Vercel (Frontend)

### Step 1: Prepare Your Code

#### 1.1 Update Backend for Production

Update `backend/server.js` to handle production environment:

```javascript
// At the top of server.js, add:
const PORT = process.env.PORT || 3001;

// Update CORS to allow your frontend URL:
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL] 
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

#### 1.2 Create Environment Variables File

Create `backend/.env.example`:
```
PORT=3001
JWT_SECRET=your-secret-key-change-this
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.vercel.app
```

#### 1.3 Update Frontend API URL

Create `frontend/.env.production`:
```
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

Update `frontend/src/App.js` to use environment variable:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
```

#### 1.4 Update Database Path for Production

In `backend/server.js`, update database path:
```javascript
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'data', 'timesheet.db')
  : path.join(__dirname, 'timesheet.db');
```

Create a `data` folder in backend for production.

---

## Step 2: Deploy Backend to Render

1. **Push your code to GitHub** (if not already done)

2. **Go to Render.com** and sign up/login (free)

3. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your repository

4. **Configure the Service**:
   - **Name**: `clock-in-out-backend` (or any name)
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && node server.js`
   - **Root Directory**: Leave empty (or set to `backend` if deploying from root)

5. **Add Environment Variables**:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = (generate a random secret key)
   - `PORT` = `10000` (Render provides this automatically, but you can set it)
   - `FRONTEND_URL` = (will be your Vercel URL - add after deploying frontend)

6. **Click "Create Web Service"**
   - Render will build and deploy your backend
   - Note your backend URL (e.g., `https://clock-in-out-backend.onrender.com`)

---

## Step 3: Deploy Frontend to Vercel

1. **Update API Base URL** in your code:
   ```javascript
   // In frontend/src/App.js
   const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
   ```

2. **Go to Vercel.com** and sign up/login with GitHub

3. **Import Your Project**:
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select the repository

4. **Configure Project**:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

5. **Add Environment Variables**:
   - `REACT_APP_API_URL` = `https://your-backend-url.onrender.com/api`

6. **Click "Deploy"**
   - Vercel will build and deploy your frontend
   - Note your frontend URL (e.g., `https://clock-in-out.vercel.app`)

7. **Update Backend CORS**:
   - Go back to Render dashboard
   - Update `FRONTEND_URL` environment variable to your Vercel URL
   - Redeploy the backend

---

## Step 4: Database Considerations

### Option A: Keep SQLite (Simple)
- Works fine for small-scale apps
- Data persists on Render's filesystem
- May reset on service restart (use Render's disk for persistence)

### Option B: Migrate to PostgreSQL (Recommended for production)
Render offers free PostgreSQL databases:

1. **Create PostgreSQL Database on Render**:
   - Click "New +" → "PostgreSQL"
   - Create database and note connection string

2. **Update Backend to Use PostgreSQL**:
   ```bash
   cd backend
   npm install pg
   ```

3. Update database connection in `server.js` (you'll need to modify the code)

---

## Alternative: Deploy Everything to Railway

Railway can deploy both frontend and backend:

1. **Go to Railway.app** and sign up
2. **Create New Project** → "Deploy from GitHub repo"
3. **Add Services**:
   - Service 1: Backend (set root directory to `backend`)
   - Service 2: Frontend (set root directory to `frontend`)
4. **Configure Environment Variables** for both services
5. **Deploy!**

---

## Quick Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Backend environment variables set
- [ ] Frontend environment variables set
- [ ] API URL updated in frontend
- [ ] CORS configured in backend
- [ ] Backend deployed and tested
- [ ] Frontend deployed and tested
- [ ] Update backend CORS with frontend URL
- [ ] Test complete flow (register, login, clock in/out)

---

## Important Notes

1. **Free tiers have limitations**:
   - Render: Services sleep after 15 minutes of inactivity (first request may be slow)
   - Vercel: Excellent performance, no sleep
   - Consider upgrading for production use

2. **Environment Variables**:
   - Never commit `.env` files to GitHub
   - Always use environment variables in production
   - Keep secrets secret!

3. **Database**:
   - SQLite works but PostgreSQL is better for production
   - Consider data backups

4. **HTTPS**:
   - Both Render and Vercel provide HTTPS automatically
   - Your app will be secure by default

5. **Domain Name** (Optional):
   - You can add a custom domain to both services
   - Vercel and Render support custom domains

---

## Testing Your Deployment

1. Visit your Vercel URL
2. Register a new account
3. Test clock in/out functionality
4. Generate reports
5. Test on different devices/browsers

---

## Troubleshooting

### Backend not connecting:
- Check CORS settings
- Verify API URL in frontend
- Check Render logs for errors

### Database errors:
- Ensure database file path is correct
- Check file permissions
- Consider using PostgreSQL

### Build errors:
- Check build logs in deployment platform
- Verify all dependencies are in package.json
- Ensure Node.js version is compatible

---

## Next Steps After Deployment

1. Monitor your application
2. Set up error tracking (Sentry, LogRocket)
3. Add analytics (Google Analytics, Plausible)
4. Set up automated backups
5. Consider adding a CDN for static assets

Good luck with your deployment! 🚀

