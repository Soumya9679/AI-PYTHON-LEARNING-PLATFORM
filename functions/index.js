const path = require("path");
const { spawn } = require("child_process");
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
const GEMINI_MODEL = "gemini-2.5-flash";

const JWT_SECRET = process.env.AUTH_JWT_SECRET || functions.config().auth?.jwt_secret || "";
const SESSION_COOKIE_NAME = "pulsepy_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const isProduction = process.env.NODE_ENV === "production";

const NETLIFY_SITE = "team-coffee-code.netlify.app";

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
      "https://team-coffee-code.netlify.app",
    ].filter(Boolean)
  )
);

const allowedOriginPatterns = [
  new RegExp(`^https://(?:[a-z0-9-]+--)?${NETLIFY_SITE.replace(/\./g, "\\.")}$`, "i"),
];

const PYTHON_BINARIES = [process.env.PYTHON_BIN, "python3", "python"].filter(Boolean);
const PYTHON_TIMEOUT_MS = 5000;
const RESULT_START = "__PY_EVAL_START__";
const RESULT_END = "__PY_EVAL_END__";
const MAX_CODE_CHARACTERS = 8000;

const challengeSuites = {
  1: {
    id: "1",
    title: "Even or Odd",
    entrypoint: "even_or_odd",
    tests: [
      { input: [2], expected: "Even" },
      { input: [7], expected: "Odd" },
      { input: [0], expected: "Even" },
      { input: [-5], expected: "Odd" },
    ],
  },
  2: {
    id: "2",
    title: "Prime Number",
    entrypoint: "is_prime",
    tests: [
      { input: [2], expected: true },
      { input: [3], expected: true },
      { input: [15], expected: false },
      { input: [17], expected: true },
      { input: [1], expected: false },
    ],
  },
  3: {
    id: "3",
    title: "Factorial",
    entrypoint: "factorial",
    tests: [
      { input: [0], expected: 1 },
      { input: [5], expected: 120 },
      { input: [7], expected: 5040 },
    ],
  },
  4: {
    id: "4",
    title: "Fibonacci Series",
    entrypoint: "fibonacci",
    tests: [
      { input: [1], expected: [0] },
      { input: [2], expected: [0, 1] },
      { input: [6], expected: [0, 1, 1, 2, 3, 5] },
    ],
  },
  5: {
    id: "5",
    title: "Reverse a String",
    entrypoint: "reverse_string",
    tests: [
      { input: ["hello"], expected: "olleh" },
      { input: ["Python"], expected: "nohtyP" },
    ],
  },
  6: {
    id: "6",
    title: "Palindrome Check",
    entrypoint: "is_palindrome",
    tests: [
      { input: ["level"], expected: true },
      { input: ["RaceCar"], expected: true },
      { input: ["nurses run"], expected: true },
      { input: ["python"], expected: false },
    ],
  },
  7: {
    id: "7",
    title: "Sum of Digits",
    entrypoint: "sum_of_digits",
    tests: [
      { input: [123], expected: 6 },
      { input: [90210], expected: 12 },
      { input: [-409], expected: 13 },
    ],
  },
  8: {
    id: "8",
    title: "Largest in List",
    entrypoint: "largest_in_list",
    tests: [
      { input: [[3, 9, 2]], expected: 9 },
      { input: [[-5, -2, -10]], expected: -2 },
      { input: [[100, 50, 75, 25]], expected: 100 },
    ],
  },
  9: {
    id: "9",
    title: "Count Vowels",
    entrypoint: "count_vowels",
    tests: [
      { input: ["hello world"], expected: 3 },
      { input: ["PYTHON"], expected: 1 },
      { input: ["aeiou"], expected: 5 },
    ],
  },
  10: {
    id: "10",
    title: "Armstrong Number",
    entrypoint: "is_armstrong",
    tests: [
      { input: [153], expected: true },
      { input: [370], expected: true },
      { input: [371], expected: true },
      { input: [9474], expected: true },
      { input: [9475], expected: false },
    ],
  },
};

const api = express();

api.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const explicitlyAllowed = allowedOrigins.includes(origin);
      const matchesPattern = allowedOriginPatterns.some((regex) => regex.test(origin));
      if (explicitlyAllowed || matchesPattern) return callback(null, true);
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

    const sessionToken = await setSessionCookie(res, buildSessionPayload(userRef.id, userProfile));

    return res.status(201).json({
      message: "Account created successfully.",
      redirectTo: "/index.html",
      sessionToken,
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

    const sessionToken = await setSessionCookie(res, buildSessionPayload(userRecord.id, userRecord));

    return res.json({
      message: "Welcome back!",
      redirectTo: "/index.html",
      sessionToken,
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

api.post(
  "/challenges/:challengeId/submit",
  asyncHandler(async (req, res) => {
    const challengeId = req.params.challengeId;
    const challenge = challengeSuites[challengeId];

    if (!challenge) {
      return res.status(404).json({ error: "Unknown challenge." });
    }

    const code = (req.body?.code || "").trim();
    if (!code) {
      return res.status(400).json({ error: "Send some code to evaluate." });
    }
    if (code.length > MAX_CODE_CHARACTERS) {
      return res.status(413).json({ error: "Code is too large. Keep submissions under 8k characters." });
    }

    try {
      const evaluation = await evaluatePythonSubmission(code, challenge);
      return res.json({
        challengeId,
        title: challenge.title,
        ...evaluation,
      });
    } catch (error) {
      functions.logger.error("Challenge evaluation failed", error);
      return res.status(error.statusCode || 500).json({
        error: error.message || "Unable to evaluate code right now.",
      });
    }
  })
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

async function evaluatePythonSubmission(code, challenge) {
  const harness = buildPythonHarness(code, challenge);
  const { payload, stdout, stderr } = await runWithPython(harness);

  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  const missingEntryPoint = payload?.missingEntryPoint || null;
  const setupError = payload?.setupError || null;
  const passed =
    !missingEntryPoint &&
    !setupError &&
    tests.length > 0 &&
    tests.every((test) => Boolean(test.passed));

  return {
    passed,
    tests,
    stdout,
    stderr,
    missingEntryPoint,
    setupError,
  };
}

function buildPythonHarness(sourceCode, challenge) {
  const encodedTests = Buffer.from(JSON.stringify(challenge.tests), "utf8").toString("base64");
  const encodedSource = Buffer.from(sourceCode, "utf8").toString("base64");
  return `
import json
import sys
import base64

START = "${RESULT_START}"
END = "${RESULT_END}"

source_code = base64.b64decode("${encodedSource}").decode("utf-8")
tests = json.loads(base64.b64decode("${encodedTests}").decode("utf-8"))

namespace = {"__builtins__": __builtins__, "__name__": "__main__"}
payload = {}

try:
    exec(source_code, namespace)
except Exception as exec_err:
    payload = {"setupError": repr(exec_err)}
else:
    fn_name = ${JSON.stringify(challenge.entrypoint)}
    fn = namespace.get(fn_name)
    if not callable(fn):
        payload = {"missingEntryPoint": fn_name}
    else:
        report = []
        for idx, case in enumerate(tests, 1):
            args = case.get("input", [])
            kwargs = case.get("kwargs", {})
            expected = case.get("expected")
            try:
                value = fn(*args, **kwargs)
                entry = {
                    "index": idx,
                    "passed": bool(value == expected),
                    "expected": expected,
                    "value": value,
                }
                if case.get("message"):
                    entry["message"] = case["message"]
                report.append(entry)
            except Exception as call_err:
                report.append({
                    "index": idx,
                    "passed": False,
                    "error": repr(call_err),
                })
        payload = {"tests": report, "entrypoint": fn_name}

print(START)
print(json.dumps(payload, default=str))
print(END)
`.trim();
}

async function runWithPython(script) {
  let lastError = null;
  for (const binary of PYTHON_BINARIES) {
    try {
      return await executePython(binary, script);
    } catch (error) {
      if (error.code === "ENOENT") {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  const runtimeError =
    lastError || new Error("Python runtime is not available in the execution environment.");
  runtimeError.statusCode = 500;
  throw runtimeError;
}

function executePython(binary, script) {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, ["-c", script], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
    }, PYTHON_TIMEOUT_MS);

    proc.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk) => stderrChunks.push(chunk));

    proc.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    proc.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (signal === "SIGKILL") {
        const timeoutError = new Error(
          "Code execution timed out. Ensure your solution finishes quickly."
        );
        timeoutError.statusCode = 408;
        return reject(timeoutError);
      }

      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      try {
        const { payload, strippedStdout } = parseRunnerOutput(stdout);
        return resolve({ payload, stdout: strippedStdout, stderr: stderr.trim() });
      } catch (error) {
        error.statusCode = 500;
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
    });
  });
}

function parseRunnerOutput(stdoutText = "") {
  const startIndex = stdoutText.indexOf(RESULT_START);
  const endIndex = stdoutText.indexOf(RESULT_END);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("Missing result payload from Python runner.");
  }

  const jsonSegment = stdoutText.substring(startIndex + RESULT_START.length, endIndex).trim();
  const payload = jsonSegment ? JSON.parse(jsonSegment) : {};
  const strippedStdout = `${stdoutText.substring(0, startIndex)}${stdoutText.substring(
    endIndex + RESULT_END.length
  )}`.trim();

  return { payload, strippedStdout };
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
  return token;
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
