const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

admin.initializeApp();

const db = getFirestore();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || functions.config().gemini?.key;
const GEMINI_MODEL = "gemini-1.5-flash";

const JWT_SECRET = process.env.AUTH_JWT_SECRET || functions.config().auth?.jwt_secret || "";
const SESSION_COOKIE_NAME = "pulsepy_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = Array.from(
  new Set(
    [
      process.env.APP_BASE_URL,
      functions.config().app?.origin,
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "http://localhost:5173",
      "http://localhost:5500",
      "http://127.0.0.1:5500",

    ].filter(Boolean)
  )
);

const api = express();

api.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed"));
    },
    credentials: true,
  })
);
api.use(express.json({ limit: "1mb" }));
api.use(cookieParser());

api.post(
  "/auth/signup",
  asyncHandler(async (req, res) => {
    const {
      fullName = "",
      email = "",
      username = "",
      password = "",
      confirmPassword = "",
    } = req.body || {};

    const trimmedFullName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const validationErrors = [];

    if (trimmedFullName.length < 2) {
      validationErrors.push("Full name must be at least 2 characters long.");
    }
    if (!isValidEmail(normalizedEmail)) {
      validationErrors.push("Provide a valid email address.");
    }
    if (normalizedUsername.length < 3) {
      validationErrors.push("Username must be at least 3 characters long.");
    }
    if (!isStrongPassword(password)) {
      validationErrors.push("Password must be 8+ characters and include a number.");
    }
    if (password !== confirmPassword) {
      validationErrors.push("Password and confirmation must match.");
    }

    if (validationErrors.length) {
      return res.status(400).json({ errors: validationErrors });
    }

    const [emailMatch, usernameMatch] = await Promise.all([
      getUserByField("emailNormalized", normalizedEmail),
      getUserByField("usernameNormalized", normalizedUsername),
    ]);

    if (emailMatch) {
      return res.status(409).json({ error: "That email is already registered." });
    }
    if (usernameMatch) {
      return res.status(409).json({ error: "That username is already taken." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userRef = db.collection("users").doc();
    const userProfile = {
      fullName: trimmedFullName,
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      username: username.trim(),
      usernameNormalized: normalizedUsername,
      passwordHash,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await userRef.set(userProfile);

    await setSessionCookie(res, buildSessionPayload(userRef.id, userProfile));

    return res.status(201).json({
      message: "Account created successfully.",
      redirectTo: "/gamified.html",
    });
  })
);

api.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { usernameOrEmail = "", password = "" } = req.body || {};
    const identifier = usernameOrEmail.trim().toLowerCase();

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ error: "Username/email and password are both required." });
    }

    const lookupField = identifier.includes("@")
      ? "emailNormalized"
      : "usernameNormalized";
    const userRecord = await getUserByField(lookupField, identifier);

    if (!userRecord) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const passwordsMatch = await bcrypt.compare(password, userRecord.passwordHash || "");
    if (!passwordsMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    await userRecord.ref.update({
      lastLoginAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await setSessionCookie(res, buildSessionPayload(userRecord.id, userRecord));

    return res.json({
      message: "Welcome back!",
      redirectTo: "/gamified.html",
    });
  })
);

api.post(
  "/auth/logout",
  (req, res) => {
    clearSessionCookie(res);
    return res.status(204).send();
  }
);

api.get(
  "/auth/session",
  authenticateRequest,
  (req, res) => res.json({ user: req.user })
);

api.use((err, req, res, next) => {
  if (err.message === "Origin not allowed") {
    return res.status(403).json({ error: "This origin is not allowed." });
  }
  functions.logger.error("API error", err);
  return res.status(err.statusCode || 500).json({ error: err.message || "Unexpected server error." });
});

exports.api = functions.https.onRequest(api);

exports.mentorHint = functions.https.onCall(async (data) => {
  const {
    code = "",
    challengeTitle = "Untitled challenge",
    description = "",
    rubric = "",
    mentorInstructions = "Offer one short hint.",
    stdout = "",
    stderr = "",
    expectedOutput = "",
  } = data || {};

  if (!code.trim()) {
    return fallbackResponse("Drop some code so I can help!", "spark");
  }

  if (!GEMINI_API_KEY) {
    return fallbackResponse("Mentor is offline. Focus on matching the expected output first!", "info");
  }

  try {
    const prompt = buildPrompt({
      challengeTitle,
      description,
      rubric,
      mentorInstructions,
      code,
      stdout,
      stderr,
      expectedOutput,
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini error: ${response.status}`);
    }

    const result = await response.json();
    const rawText = result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join(" ")
      .trim();

    const sanitized = sanitizeHint(rawText);

    return {
      hint: sanitized || fallbackCopy(stdout, stderr),
      tone: stderr ? "calm" : "spark",
      model: `Gemini (${GEMINI_MODEL})`,
    };
  } catch (error) {
    console.error("mentorHint failure", error);
    return fallbackResponse(
      "Mentor had a hiccup. Check your loop length or print spacing while we reconnect.",
      "calm"
    );
  }
});

function buildPrompt({
  challengeTitle,
  description,
  rubric,
  mentorInstructions,
  code,
  stdout,
  stderr,
  expectedOutput,
}) {
  return `You are Gemini acting as a patient Python mentor. ${mentorInstructions}

Challenge: ${challengeTitle}
Brief: ${description}
Success rubric: ${rubric}
Expected output:\n${expectedOutput}

Learner code:\n${code}

Program stdout:\n${stdout}

Errors or mismatch info:\n${stderr || "No runtime error."}

Respond with:
1. A gentle explanation of what is wrong or missing (max 2 sentences).
2. One actionable hint. No full solutions, no full code snippets. Encourage them to retry.`;
}

function sanitizeHint(text = "") {
  if (!text) return "Focus on matching the three-loop pattern and keep the print text identical each time.";
  const withoutCode = text.replace(/```[\s\S]*?```/g, "").replace(/print\s*\(.+\)/gi, "use print(..)");
  const trimmed = withoutCode.split(/\n{2,}/)[0]?.trim();
  return trimmed || text;
}

function fallbackResponse(message, tone = "info") {
  return {
    hint: message,
    tone,
    model: "mentor-fallback",
  };
}

function fallbackCopy(stdout, stderr) {
  if (stderr) {
    return "Check the exact error message and verify your loop syntax or indentation.";
  }
  if (!stdout?.trim()) {
    return "Nothing printed yet. Make sure your loop calls print inside the body.";
  }
  return "Compare your lines with the expected output and adjust the spacing or count.";
}

function isValidEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isStrongPassword(value = "") {
  return value.length >= 8 && /[0-9]/.test(value);
}

async function getUserByField(field, value) {
  const snapshot = await db.collection("users").where(field, "==", value).limit(1).get();
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return { id: doc.id, ref: doc.ref, ...doc.data() };
}

function requireJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error("Missing AUTH_JWT_SECRET environment variable.");
  }
  return JWT_SECRET;
}

function buildSessionPayload(id, profile) {
  return {
    uid: id,
    email: profile.email,
    username: profile.username,
    fullName: profile.fullName,
  };
}

async function setSessionCookie(res, payload) {
  const token = jwt.sign(payload, requireJwtSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
  res.cookie(SESSION_COOKIE_NAME, token, getCookieSettings());
}

function clearSessionCookie(res) {
  const base = getCookieSettings(true);
  res.clearCookie(SESSION_COOKIE_NAME, base);
}

function getCookieSettings(isForClearing = false) {
  const base = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
  if (isForClearing) {
    return { ...base, maxAge: 0 };
  }
  return { ...base, maxAge: TOKEN_TTL_SECONDS * 1000 };
}

function authenticateRequest(req, res, next) {
  try {
    const token =
      req.cookies?.[SESSION_COOKIE_NAME] || extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    const payload = jwt.verify(token, requireJwtSecret());
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

function extractBearerToken(header = "") {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.substring(7);
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
