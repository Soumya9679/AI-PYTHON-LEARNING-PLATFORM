import { clearSessionToken, applyAuthHeaders } from "./session.js";
import { fetchAuth } from "./apiClient.js";

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");
const heroPrimaryCta = document.querySelector(".cta-row .solid-btn");
const heroSecondaryCta = document.querySelector(".cta-row .outline-btn");

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
wireLogout(logoutBtn);

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

function wireLogout(button) {
	if (!button) return;
	const defaultLabel = button.textContent?.trim() || "Log out";
	button.addEventListener("click", async () => {
		button.disabled = true;
		button.textContent = "Logging out...";
		try {
			const headers = applyAuthHeaders({ "Content-Type": "application/json" });
			await fetchAuth("/logout", {
				method: "POST",
				credentials: "include",
				headers,
			});
		} catch (error) {
			console.error("Failed to log out", error);
		} finally {
			clearSessionToken();
			setAuthState(false);
			button.disabled = false;
			button.textContent = defaultLabel;
		}
	});
}

async function hydrateAuthState() {
	try {
		const headers = applyAuthHeaders({ Accept: "application/json" });
		const response = await fetchAuth("/session", {
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