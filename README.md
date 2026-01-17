# PulsePy — AI Python IDE and Learning Platform

A playful, student‑friendly Python learning platform with a browser IDE, challenge grading, and Gemini‑powered mentor hints.

## Features

- **Interactive IDE** with Monaco editor and a live Python runtime (Pyodide).
- **Challenge mode** with server‑side grading and test feedback.
- **Gemini mentor** that provides short, spoiler‑free hints.
- **Auth system** with signup/login, JWT sessions, and Firestore user storage.
- **Responsive UI** for dashboard, challenges, games, and IDE views.

## Project structure

```
backend/              # Express API (auth, grading, Gemini hints)
public/               # Static frontend (HTML/CSS/JS)
```

Key folders:
- **backend/src/server.js** — API routes, auth, grading, Gemini integration
- **public/scripts/** — frontend logic (auth, IDE, challenges)
- **public/styles/** — UI styling

## Tech stack

**Frontend**
- HTML, CSS, JavaScript
- Monaco Editor
- Pyodide (in‑browser Python runtime)

**Backend**
- Node.js + Express
- Firebase Admin SDK (Firestore)
- JWT + bcrypt
- Gemini API (Google Generative Language)

## How it works (high level)

1. **Frontend** pages load static HTML and JS from `public/`.
2. **API base** is read from `<meta name="pulsepy-api-base" ...>` and used by `public/scripts/config.js`.
3. **Auth flow** calls `/auth/signup`, `/auth/login`, `/auth/session`, `/auth/logout`.
4. **Challenges** POST code to `/challenges/:id/submit` and receive test results.
5. **Mentor hints** POST to `/mentorHint` which calls Gemini and returns a short hint.

## Environment setup

Create a backend env file:

```
cd backend
cp .env.example .env
```

Required environment variables (backend):
- `GEMINI_API_KEY` — Google Gemini API key
- `AUTH_JWT_SECRET` — secret for signing session tokens
- `FIREBASE_SERVICE_ACCOUNT` — JSON service account (string)
- `APP_BASE_URL` — frontend URL
- `ALLOWED_ORIGINS` — comma‑separated frontend URLs

Optional:
- `GEMINI_MODEL` (default: `gemini-2.5-flash`)
- `PYTHON_BIN` (default tries `python3`, `python`)

## Run locally

Backend:

```
cd backend
npm install
npm run dev
```

Frontend (static):
- Open `public/index.html` directly, or
- Serve `public/` with a static server (recommended).

## Deployment

- **Frontend**: Netlify / Vercel / static hosting
- **Backend**: Render / Vercel / any Node.js host

Update the meta tag in frontend HTML:

```
<meta name="pulsepy-api-base" content="https://YOUR_BACKEND_URL" />
```

## Demo pages

- `index.html` — landing page
- `login.html` / `signup.html` — auth
- `challenges.html` — test‑graded challenges
- `ide.html` — live IDE + mentor hints
- `gamified.html` — game‑style dashboard

## Security notes

- Passwords are hashed with bcrypt before storing in Firestore.
- Sessions use JWT stored in httpOnly cookies.
- CORS is restricted to allowed origins set in env.

## Credits

Built for student‑friendly Python learning with a focus on fast feedback and supportive AI hints.
