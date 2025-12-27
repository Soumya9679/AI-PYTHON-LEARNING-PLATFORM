const STATIC_DEV_HOST_REGEX = /localhost:5500|127\.0\.0\.1:5500/;
const PROJECT_ID = "ai-python-ide";
const FUNCTION_REGION = "us-central1";
const DEFAULT_LOCAL_API_BASE = "http://localhost:8080";
const FUNCTIONS_LOCAL_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/${FUNCTION_REGION}/api`;
const FUNCTIONS_REMOTE_BASE = "/api";
const META_MODE = document
  .querySelector("meta[name='pulsepy-api-mode']")
  ?.content?.trim()
  .toLowerCase();

function parseList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(list = []) {
  return Array.from(new Set(list.filter(Boolean)));
}

const metaBaseContent = document
  .querySelector("meta[name='pulsepy-api-base']")
  ?.content?.trim();
const META_REMOTE_BASES = parseList(metaBaseContent);
const RENDER_REMOTE_BASE = "https://pulsepy-backend.onrender.com";
const DEFAULT_REMOTE_API_BASES = unique([...META_REMOTE_BASES, RENDER_REMOTE_BASE]);
const DEFAULT_REMOTE_API_BASE = DEFAULT_REMOTE_API_BASES[0] || RENDER_REMOTE_BASE;
const queryParams = new URLSearchParams(window.location.search || "");
const overrideBase = queryParams.get("apiBase");
const forcedMode = queryParams.get("apiMode")?.toLowerCase();

function normalizeBase(url) {
  if (!url) return "";
  return url.replace(/\/+$/, "");
}

export const isStaticDevHost = STATIC_DEV_HOST_REGEX.test(window.location.host);
const overrideBases = parseList(overrideBase);
const backendBasePool = isStaticDevHost
  ? [DEFAULT_LOCAL_API_BASE]
  : [...overrideBases, ...DEFAULT_REMOTE_API_BASES];
const normalizedBackendBases = unique(
  backendBasePool.map((base) => normalizeBase(base)).filter(Boolean)
);
const backendBases = normalizedBackendBases.length
  ? normalizedBackendBases
  : unique([normalizeBase(DEFAULT_REMOTE_API_BASE)]);
const functionsBase = normalizeBase(isStaticDevHost ? FUNCTIONS_LOCAL_BASE : FUNCTIONS_REMOTE_BASE);

const mode = forcedMode || META_MODE;
const priorityBases = unique(
  (mode === "functions"
    ? [functionsBase, ...backendBases]
    : [...backendBases, functionsBase]
  ).filter(Boolean)
);

export const API_BASE = priorityBases[0] || normalizeBase(DEFAULT_REMOTE_API_BASE);
export const FUNCTION_API_BASE = functionsBase;

function buildTargets(segment = "") {
  const cleanSegment = segment.replace(/^\/+/, "");
  return Array.from(
    new Set(
      priorityBases
        .map((base) => (cleanSegment ? `${base}/${cleanSegment}` : base))
        .filter(Boolean)
    )
  );
}

export const API_TARGETS = {
  auth: buildTargets("auth"),
  challenges: buildTargets("challenges"),
  mentorHint: buildTargets("mentorHint"),
};

export function resolvePublicPath(target = "/") {
  if (!target) {
    target = "/";
  }
  if (/^https?:\/\//i.test(target)) {
    return target;
  }
  const normalized = target.startsWith("/") ? target : `/${target}`;
  if (!isStaticDevHost) {
    return normalized;
  }
  if (normalized.startsWith("/public/")) {
    return normalized;
  }
  return `/public${normalized}`;
}
