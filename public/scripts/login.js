import { persistSessionToken, clearSessionToken } from "./session.js";

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginStatus = document.getElementById("loginStatus");
const signupStatus = document.getElementById("signupStatus");

const PROJECT_ID = "ai-python-ide";
const NETLIFY_SITE = "team-coffee-code.netlify.app";
const hostName = window.location.hostname || "";
const isStaticDevHost = /localhost:5500|127\.0\.0\.1:5500/.test(window.location.host);
const isNetlifyDeployment =
  hostName === NETLIFY_SITE ||
  hostName.endsWith(`--${NETLIFY_SITE}`);
const emulatorBase = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/api/auth`;
const API_BASE = (isStaticDevHost || isNetlifyDeployment) ? emulatorBase : "/api/auth";
const DEFAULT_REDIRECT = isStaticDevHost ? "/public/index.html" : "/index.html";
const LOGIN_REDIRECT = loginForm?.dataset.redirect ?? DEFAULT_REDIRECT;
const SIGNUP_REDIRECT = signupForm?.dataset.redirect ?? DEFAULT_REDIRECT;

function resolveRedirect(preferred, fallback) {
  const target = preferred || fallback || "/";
  if (!isStaticDevHost) {
    return target;
  }
  if (target.startsWith("/public/")) {
    return target;
  }
  if (target.endsWith(".html")) {
    return target.startsWith("/") ? `/public${target}` : `/public/${target}`;
  }
  return `/public/${target.replace(/^\//, "")}`;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validatePassword(value) {
  const trimmed = value.trim();
  return trimmed.length >= 8 && /[0-9]/.test(trimmed);
}

function displayStatus(element, message, type = "info") {
  if (!element) return;
  element.textContent = message;
  element.classList.remove("error", "success", "info");
  element.classList.add(type);
}

function toggleFormDisabled(form, disabled) {
  if (!form) return;
  form.querySelectorAll("input, button").forEach((node) => {
    node.disabled = disabled;
    if (disabled) {
      node.classList.add("is-loading");
    } else {
      node.classList.remove("is-loading");
    }
  });
}

async function postAuth(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (response.ok && data.sessionToken) {
    persistSessionToken(data.sessionToken);
  } else if (!response.ok && response.status === 401) {
    clearSessionToken();
  }
  if (!response.ok) {
    const errorMessage = data.error || data.errors?.[0] || "Unexpected error. Please try again.";
    throw new Error(errorMessage);
  }
  return data;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const usernameValue = document.getElementById("loginUsername")?.value.trim() ?? "";
  const passwordValue = document.getElementById("loginPassword")?.value ?? "";

  if (usernameValue.length < 2 || !validatePassword(passwordValue)) {
    displayStatus(
      loginStatus,
      "Use a valid username/email and a password with 8 characters including a number.",
      "error"
    );
    return;
  }

  displayStatus(loginStatus, "Signing you in...", "info");
  toggleFormDisabled(loginForm, true);

  try {
    const result = await postAuth("/login", {
      usernameOrEmail: usernameValue,
      password: passwordValue,
    });
    displayStatus(loginStatus, "Welcome back! Redirecting...", "success");
    window.location.assign(resolveRedirect(result.redirectTo, LOGIN_REDIRECT));
  } catch (error) {
    displayStatus(loginStatus, error.message, "error");
    toggleFormDisabled(loginForm, false);
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  const fullName = document.getElementById("signupFullName")?.value.trim() ?? "";
  const emailValue = document.getElementById("signupEmail")?.value ?? "";
  const usernameValue = document.getElementById("signupUsername")?.value.trim() ?? "";
  const passwordValue = document.getElementById("signupPassword")?.value ?? "";
  const confirmValue = document.getElementById("signupConfirmPassword")?.value ?? "";

  const fullNameOk = fullName.length >= 2;
  const emailOk = validateEmail(emailValue);
  const usernameOk = usernameValue.length >= 3;
  const passwordOk = validatePassword(passwordValue);
  const matchOk = passwordValue === confirmValue;

  if (!fullNameOk || !emailOk || !usernameOk || !passwordOk || !matchOk) {
    displayStatus(
      signupStatus,
      "Please fill every field, use a real email, and ensure both passwords match.",
      "error"
    );
    return;
  }

  displayStatus(signupStatus, "Creating your account...", "info");
  toggleFormDisabled(signupForm, true);

  try {
    const result = await postAuth("/signup", {
      fullName,
      email: emailValue,
      username: usernameValue,
      password: passwordValue,
      confirmPassword: confirmValue,
    });
    displayStatus(signupStatus, "Account ready! Redirecting...", "success");
    window.location.assign(resolveRedirect(result.redirectTo, SIGNUP_REDIRECT));
  } catch (error) {
    displayStatus(signupStatus, error.message, "error");
    toggleFormDisabled(signupForm, false);
  }
}

if (loginForm) {
  loginForm.addEventListener("submit", handleLoginSubmit);
}

if (signupForm) {
  signupForm.addEventListener("submit", handleSignupSubmit);
}
