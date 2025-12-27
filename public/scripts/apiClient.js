import { API_TARGETS } from "./config.js";

function makeUrl(base = "", path = "") {
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${trimmedBase}${trimmedPath}` || trimmedPath || trimmedBase;
}

async function fetchFromTargets(targets = [], path = "", options = {}) {
  const uniqueTargets = Array.from(new Set(targets)).filter(Boolean);
  let lastError = null;

  for (const target of uniqueTargets) {
    const url = makeUrl(target, path);
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error("All API endpoints are unreachable.");
}

export function fetchAuth(path, options = {}) {
  return fetchFromTargets(API_TARGETS.auth, path, options);
}

export function fetchChallenges(path, options = {}) {
  return fetchFromTargets(API_TARGETS.challenges, path, options);
}

export function fetchMentor(path, options = {}) {
  return fetchFromTargets(API_TARGETS.mentorHint, path, options);
}

export function configureRequestOptions(options = {}) {
  return { ...options };
}
