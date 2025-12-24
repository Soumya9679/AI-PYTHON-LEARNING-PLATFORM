import { clearSessionToken, applyAuthHeaders } from "./session.js";

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const heroPrimaryCta = document.querySelector(".cta-row .solid-btn");
const heroSecondaryCta = document.querySelector(".cta-row .outline-btn");

const PROJECT_ID = "ai-python-ide";
const NETLIFY_SITE = "team-coffee-code.netlify.app";
const hostName = window.location.hostname || "";
const isStaticDevHost = /localhost:5500|127\.0\.0\.1:5500/.test(window.location.host);
const isNetlifyDeployment =
	hostName === NETLIFY_SITE ||
	hostName.endsWith(`--${NETLIFY_SITE}`);
const emulatorBase = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1/api`;
const API_BASE = (isStaticDevHost || isNetlifyDeployment) ? emulatorBase : "/api";
const AUTHENTICATED_CLASS = "is-auth";
const AUTH_SLOT_SELECTOR = "[data-auth-slot]";

function wireNavigation(button, targetHref) {
	if (!button || !targetHref) return;
	button.addEventListener("click", () => {
		window.location.href = targetHref;
	});
}

wireNavigation(loginBtn, "login.html");
wireNavigation(signupBtn, "signup.html");
wireNavigation(heroPrimaryCta, "signup.html");
wireNavigation(heroSecondaryCta, "https://www.youtube.com/watch?v=ysz5S6PUM-U");

function setAuthState(isAuthenticated) {
	const root = document.body;
	if (root) {
		root.classList.toggle(AUTHENTICATED_CLASS, Boolean(isAuthenticated));
	}
	document.querySelectorAll(AUTH_SLOT_SELECTOR).forEach((node) => {
		const slot = node.dataset.authSlot || "all";
		const shouldShow =
			slot === "protected"
				? Boolean(isAuthenticated)
			: slot === "guest"
				? !isAuthenticated
				: true;
		node.hidden = !shouldShow;
		if (shouldShow) {
			node.removeAttribute("aria-hidden");
		} else {
			node.setAttribute("aria-hidden", "true");
		}
	});
}

async function hydrateAuthState() {
	try {
		const headers = applyAuthHeaders({ Accept: "application/json" });
		const response = await fetch(`${API_BASE}/auth/session`, {
			method: "GET",
			credentials: "include",
			headers,
		});
		if (!response.ok) {
			if (response.status === 401) {
				clearSessionToken();
			}
			setAuthState(false);
			return;
		}
		const payload = await response.json().catch(() => null);
		setAuthState(Boolean(payload?.user));
	} catch (error) {
		clearSessionToken();
		setAuthState(false);
	}
}

hydrateAuthState();