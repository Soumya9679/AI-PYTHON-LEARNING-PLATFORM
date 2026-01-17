# PulsePy Backend (Render-ready)

## Local setup

```bash
cd backend
cp .env.example .env # fill in values
npm install
npm run dev
```

Expose a Firebase service account JSON via `FIREBASE_SERVICE_ACCOUNT`. When running locally against Firestore emulator, set `FIRESTORE_EMULATOR_HOST=localhost:8080`.

## Deploy to Render

1. Push this folder to GitHub.
2. In Render dashboard, create a **Web Service** pointing to the repository and set **Root Directory** to `backend`.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment variables:
   - `PORT=10000` (Render supplies automatically but set default just in case)
   - `GEMINI_API_KEY`
   - `AUTH_JWT_SECRET`
   - `APP_BASE_URL=https://your-frontend-domain`
   - `ALLOWED_ORIGINS=https://your-frontend-domain`
   - `FIREBASE_SERVICE_ACCOUNT={...}` (JSON string)
   - `PYTHON_BIN=python3` (if needed)
6. Deploy. Render will expose the public URL you can configure inside `public/scripts/ide.js` as the mentor/API base.
