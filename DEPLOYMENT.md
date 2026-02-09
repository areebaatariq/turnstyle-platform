# Deploying Turnstyle to Render

This guide walks through deploying the **backend** (Node.js API) and **frontend** (Vite + React) to [Render](https://render.com). You will create two services: one Web Service for the API and one Static Site (or Web Service) for the frontend.

---

## Prerequisites

- A [Render](https://render.com) account (free tier works)
- Code in a Git repo (GitHub, GitLab, or Bitbucket) that Render can access
- **Database:** Render does not host MongoDB. Use [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier) and set `MONGODB_URI` in the backend.  
  **Note:** The backend can use file-based storage locally; on Render the filesystem is **ephemeral** (data is lost on deploy/restart). For production, use MongoDB or another persistent database.

---

## 1. Backend (Web Service)

### 1.1 Create a new Web Service

1. In Render Dashboard: **New → Web Service**.
2. Connect your repo and select the **stylist wardrobe** (or your repo name).
3. Configure:
   - **Name:** e.g. `turnstyle-api`
   - **Region:** Choose closest to your users
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`

### 1.2 Environment variables

In the Web Service → **Environment** tab, add:

| Key | Description | Example |
|-----|-------------|--------|
| `PORT` | Leave as-is; Render sets this automatically. | (Render sets it) |
| `NODE_ENV` | `production` | `production` |
| `JWT_SECRET` | Strong random secret for JWT signing | e.g. long random string |
| `JWT_EXPIRES_IN` | Optional | `7d` |
| `MONGODB_URI` | MongoDB connection string (e.g. Atlas) | `mongodb+srv://user:pass@cluster.mongodb.net/dbname?retryWrites=true&w=majority` |
| `FRONTEND_URL` | Full URL of your frontend on Render | `https://turnstyle-wardrobe.onrender.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | Must match Google Console; use your **backend** URL | `https://turnstyle-api.onrender.com/api/auth/google/callback` |
| `APPLE_CLIENT_ID` | Apple Sign In | From Apple Developer |
| `APPLE_TEAM_ID` | Apple Sign In | From Apple Developer |
| `APPLE_KEY_ID` | Apple Sign In | From Apple Developer |
| `APPLE_PRIVATE_KEY` or `APPLE_PRIVATE_KEY_PATH` | Apple .p8 key (see below) | Contents of `.p8` or path |
| `APPLE_REDIRECT_URI` | Use your **backend** URL | `https://turnstyle-api.onrender.com/api/auth/apple/callback` |
| `SENDGRID_API_KEY` | For invite emails | From SendGrid |
| `FROM_EMAIL` | Sender email | e.g. `noreply@yourdomain.com` |

**Apple private key on Render:** Render has no persistent filesystem. Either:

- Put the **contents** of your `.p8` file into an env var (e.g. `APPLE_PRIVATE_KEY`) and update the backend to read the key from that env var instead of a file path, or  
- Use a path that you bake into the image (not typical on Render). Prefer the env-var approach.

### 1.3 OAuth redirect URLs

- In **Google Cloud Console** → Credentials → your OAuth client → add **Authorized redirect URI**:  
  `https://<your-backend>.onrender.com/api/auth/google/callback`
- In **Apple Developer** → your Service ID → add your backend domain and redirect path:  
  `https://<your-backend>.onrender.com/api/auth/apple/callback`

### 1.4 Deploy

Click **Create Web Service**. Render will run `npm install && npm run build` then `npm start`.  
Note the backend URL, e.g. `https://turnstyle-api.onrender.com`. You will use this as `VITE_API_URL` for the frontend.

---

## 2. Frontend (Static Site)

Using a **Static Site** is the simplest way to host the Vite app (build once, serve static files).

### 2.1 Create a new Static Site

1. **New → Static Site**.
2. Connect the same repo.
3. Configure:
   - **Name:** e.g. `turnstyle-wardrobe`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

### 2.2 Environment variables (build-time)

Vite bakes `VITE_*` variables into the build. Add **one** variable at build time:

| Key | Value |
|-----|--------|
| `VITE_API_URL` | Your backend API base URL **including** `/api` if your frontend expects it. |

From your code, the frontend uses `VITE_API_URL` as the base for API calls (e.g. in `api.ts` it’s used as `API_BASE_URL`). Use the **base API URL** that matches your frontend:

- If your `api.ts` expects the base to already include `/api`, set:  
  `VITE_API_URL=https://turnstyle-api.onrender.com/api`
- If it appends `/api` itself, set:  
  `VITE_API_URL=https://turnstyle-api.onrender.com`

From the codebase, `api.ts` uses `VITE_API_URL` as the full base (e.g. `http://localhost:3000/api`), so use:

```bash
VITE_API_URL=https://<your-backend>.onrender.com/api
```

Replace `<your-backend>` with your actual backend service hostname (e.g. `turnstyle-api.onrender.com`).

### 2.3 Deploy

Click **Create Static Site**. After the build, Render will serve the `dist` folder. Your app will be at e.g. `https://turnstyle-wardrobe.onrender.com`.

---

## 3. CORS

The backend already allows:

- `process.env.FRONTEND_URL`
- `http://localhost:5137`
- `https://turnstyle-wardrobe.onrender.com`

Set **FRONTEND_URL** on the backend to your real frontend URL (e.g. `https://turnstyle-wardrobe.onrender.com`) so CORS allows requests from your deployed frontend.

---

## 4. Optional: Frontend as Web Service (SPA fallback)

If you want SPA fallback (all routes serve `index.html`) and don’t want to use Render’s Static Site rewrites, you can run the frontend as a **Web Service**:

- **Root Directory:** `frontend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npx serve -s dist -l $PORT` (install `serve` as a dependency), or use the existing `npm run start` if it runs `vite preview --port $PORT --host 0.0.0.0` (and ensure `PORT` is set by Render).

Your `package.json` already has `"start": "vite preview --port $PORT --host 0.0.0.0"`. On Render, `PORT` is set automatically, so you can use **Start Command:** `npm run start` and add `PORT` only if required. Prefer **Static Site** for lower cost and simpler setup.

---

## 5. Checklist

- [ ] Backend Web Service: root `backend`, build `npm install && npm run build`, start `npm start`
- [ ] Backend env: `NODE_ENV=production`, `JWT_SECRET`, `MONGODB_URI` (or persistent DB), `FRONTEND_URL`, Google/Apple OAuth vars, SendGrid
- [ ] Google & Apple redirect URIs updated to backend URL
- [ ] Frontend Static Site: root `frontend`, build `npm install && npm run build`, publish `dist`
- [ ] Frontend env: `VITE_API_URL=https://<backend>.onrender.com/api`
- [ ] After first deploy: open frontend URL and test login (Google/Apple) and API calls

---

## 6. Free tier notes

- **Web Services** on the free tier spin down after inactivity; the first request after idle can be slow (cold start).
- **Static Sites** don’t spin down.
- MongoDB Atlas free tier is usually enough for development and light production.

For more detail on backend env vars and OAuth, see [backend/README.md](backend/README.md).
