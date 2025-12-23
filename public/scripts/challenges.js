"use strict";

const PROJECT_ID = "ai-python-ide";
const DEFAULT_API_BASE = "/api";
const LOCAL_FUNCTIONS_API = `http://localhost:5001/${PROJECT_ID}/us-central1/api`;
const MONACO_BASE_URL = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min";
const MONACO_LOADER_URL = `${MONACO_BASE_URL}/vs/loader.min.js`;
const MONACO_REQUIRE_PATH = `${MONACO_BASE_URL}/vs`;
const MONACO_THEME = "pulsepy-dark";
const API_BASE = resolveApiBase();

const CHALLENGE_FILE_MAP = {
  1: "even_or_odd.py",
  2: "prime_check.py",
  3: "factorial.py",
  4: "fibonacci.py",
  5: "reverse_string.py",
  6: "palindrome.py",
  7: "sum_digits.py",
  8: "largest_in_list.py",
  9: "count_vowels.py",
  10: "armstrong.py",
};

const STATUS_VARIANTS = {
  idle: { label: "Not attempted", className: "" },
  running: { label: "Running tests…", className: "status-badge--pending" },
  pass: { label: "All tests passed", className: "status-badge--passed" },
  fail: { label: "Needs work", className: "status-badge--failed" },
  error: { label: "Error", className: "status-badge--failed" },
};

const STORAGE_PREFIX = "challenge-code-";
const monacoReady = loadMonaco();

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const monaco = await monacoReady;
    defineTheme(monaco);
    const cards = document.querySelectorAll(".card[data-challenge-id]");
    cards.forEach((card) => attachCardHandlers(card, monaco));
  } catch (error) {
    console.error("Failed to initialize Monaco", error);
    alert("Unable to load the code editor. Please refresh the page.");
  }
});

function loadMonaco() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const scriptId = "monaco-loader-script";

    const boot = () => {
      if (typeof window.require !== "function") {
        return false;
      }
      window.require.config({ paths: { vs: MONACO_REQUIRE_PATH } });
      window.require(["vs/editor/editor.main"], () => resolve(window.monaco));
      return true;
    };

    const poll = () => {
      if (boot()) return;
      if (Date.now() - start > 15000) {
        reject(new Error("Timed out loading Monaco editor."));
        return;
      }
      setTimeout(poll, 40);
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = MONACO_LOADER_URL;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = poll;
      script.onerror = () => reject(new Error("Failed to download Monaco editor assets."));
      document.head.appendChild(script);
    } else {
      poll();
    }
  });
}

function defineTheme(monaco) {
  if (!monaco?.editor?.defineTheme) return;
  monaco.editor.defineTheme(MONACO_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "94a3b8" },
      { token: "keyword", foreground: "c084fc" },
      { token: "string", foreground: "7dd3fc" },
      { token: "number", foreground: "fcd34d" },
      { token: "type.identifier", foreground: "f472b6" },
    ],
    colors: {
      "editor.background": "#050f1f",
      "editorCursor.foreground": "#38bdf8",
      "editorLineNumber.foreground": "#6b7280",
      "editorLineNumber.activeForeground": "#f8fafc",
      "editor.selectionBackground": "#1d4ed833",
      "editorIndentGuide.background": "#1f2937",
    },
  });
  monaco.editor.setTheme(MONACO_THEME);
}

function resolveApiBase() {
  const { hostname, port } = window.location;
  const isLiveDevServer = ["5500", "5173", "3000"].includes(port);
  const isLocalHost = hostname === "127.0.0.1" || hostname === "localhost";

  if (isLocalHost && isLiveDevServer) {
    return LOCAL_FUNCTIONS_API;
  }

  return DEFAULT_API_BASE;
}

function attachCardHandlers(card, monaco) {
  const challengeId = card.dataset.challengeId;
  const textarea = card.querySelector("textarea");
  const button = card.querySelector(".submit-btn");
  const resultEl = card.querySelector(".result");
  const statusEl = document.getElementById(`status-${challengeId}`);
  const filename = CHALLENGE_FILE_MAP[challengeId] || `challenge-${challengeId}.py`;

  const savedDraft = sanitizeInitialValue(getSavedDraft(challengeId));
  const defaultValue = sanitizeInitialValue(textarea?.value ?? "");
  const initialValue = savedDraft || defaultValue;

  const editor = mountMonacoEditor({
    monaco,
    textarea,
    fileLabel: filename,
    initialValue,
    onChange: (value) => persistDraft(challengeId, value),
  });

  button.addEventListener("click", async () => {
    const code = editor?.getValue?.() || "";
    if (!code.trim()) {
      renderInlineError(resultEl, "Please write some code before running the tests.");
      updateStatus(statusEl, "fail", "No code");
      return;
    }

    await submitChallenge({ challengeId, code, button, resultEl, statusEl });
  });
}

async function submitChallenge({ challengeId, code, button, resultEl, statusEl }) {
  setButtonState(button, true, 'Running…');
  updateStatus(statusEl, 'running');
  renderInlineInfo(resultEl, '⏳ Evaluating your code…');

  try {
    const response = await fetch(`${API_BASE}/challenges/${challengeId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || 'Server error while grading code.');
    }

    renderResult(payload, resultEl, statusEl);
  } catch (error) {
    console.error('challenge submission failed', error);
    renderInlineError(resultEl, error.message || 'Unexpected error.');
    updateStatus(statusEl, 'error', 'Error');
  } finally {
    setButtonState(button, false, 'Run Tests');
  }
}

function renderResult(payload, resultEl, statusEl) {
  const {
    passed = false,
    tests = [],
    missingEntryPoint,
    setupError,
    stdout = '',
    stderr = '',
  } = payload || {};

  if (missingEntryPoint) {
    updateStatus(statusEl, 'fail', 'Missing function');
    resultEl.innerHTML = createHtmlBlock({
      summary: `Define the function <code>${escapeHTML(missingEntryPoint)}</code> exactly as described before running tests.`,
      summaryClass: 'fail',
    });
    return;
  }

  if (setupError) {
    updateStatus(statusEl, 'fail', 'Crashed');
    resultEl.innerHTML = createHtmlBlock({
      summary: `Your code crashed before tests could run: ${escapeHTML(setupError)}`,
      summaryClass: 'fail',
      stderr,
    });
    return;
  }

  const failedCount = tests.filter((test) => !test.passed).length;
  const summaryClass = passed ? 'pass' : 'fail';
  const summaryText = tests.length
    ? passed
      ? '✅ All tests passed!'
      : `❌ ${failedCount} of ${tests.length} tests failed.`
    : '⚠️ Tests did not return any results.';

  updateStatus(statusEl, passed ? 'pass' : 'fail');

  resultEl.innerHTML = createHtmlBlock({
    summary: summaryText,
    summaryClass,
    tests,
    stdout,
    stderr,
  });
}

function createHtmlBlock({ summary, summaryClass, tests = [], stdout, stderr }) {
  const testList = tests.length ? renderTests(tests) : '';
  const logs = renderLogs({ stdout, stderr });
  return `
    <p class="result-summary ${summaryClass}">${summary}</p>
    ${testList}
    ${logs}
  `;
}

function renderTests(tests) {
  const rows = tests
    .map((test) => {
      const badge = test.passed ? '✅' : '⚠️';
      const valueLabel = test.passed
        ? `Got ${formatValue(test.value)}`
        : `Expected ${formatValue(test.expected)} but got ${formatValue(test.value)}`;
      const details = test.error
        ? escapeHTML(test.error)
        : valueLabel;
      return `
        <li class="test-row ${test.passed ? 'pass' : 'fail'}">
          <span>${badge} Test ${test.index}</span>
          <span>${details}</span>
        </li>
      `;
    })
    .join('');

  return `<ul class="test-list">${rows}</ul>`;
}

function renderLogs({ stdout, stderr }) {
  const parts = [];
  if (stderr) {
    parts.push(`
      <details class="log-block" open>
        <summary>stderr</summary>
        <pre>${escapeHTML(stderr)}</pre>
      </details>
    `);
  }
  if (stdout) {
    parts.push(`
      <details class="log-block">
        <summary>stdout</summary>
        <pre>${escapeHTML(stdout)}</pre>
      </details>
    `);
  }
  return parts.join('');
}

function updateStatus(statusEl, variant, customLabel) {
  if (!statusEl) return;
  statusEl.className = `status-badge ${STATUS_VARIANTS[variant]?.className || ''}`.trim();
  const fallback = STATUS_VARIANTS[variant]?.label || STATUS_VARIANTS.idle.label;
  statusEl.textContent = customLabel || fallback;
}

function setButtonState(button, disabled, label) {
  if (!button) return;
  button.disabled = disabled;
  if (label) {
    button.textContent = label;
  }
}

function renderInlineError(target, message) {
  if (!target) return;
  target.innerHTML = `<p class="result-summary fail">${escapeHTML(message)}</p>`;
}

function renderInlineInfo(target, message) {
  if (!target) return;
  target.innerHTML = `<p class="result-summary pending">${escapeHTML(message)}</p>`;
}

function formatValue(value) {
  try {
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function escapeHTML(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSavedDraft(challengeId) {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${challengeId}`) || "";
  } catch (error) {
    console.warn("Unable to read saved code", error);
    return "";
  }
}

function persistDraft(challengeId, value) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${challengeId}`, value);
  } catch (error) {
    console.warn("Unable to save code draft", error);
  }
}

function sanitizeInitialValue(value = "") {
  if (!value) return "";
  return value.replace(/^[\r\n]+/, "");
}

function mountMonacoEditor({ monaco, textarea, fileLabel, initialValue, onChange }) {
  if (!textarea || !monaco?.editor) {
    return {
      getValue: () => initialValue,
    };
  }

  const wrapper = document.createElement("div");
  wrapper.className = "code-editor";

  const header = document.createElement("div");
  header.className = "code-editor__header";

  const traffic = document.createElement("div");
  traffic.className = "code-editor__traffic";
  ["red", "amber", "green"].forEach((tone) => {
    const dot = document.createElement("span");
    dot.className = `traffic-dot traffic-dot--${tone}`;
    traffic.appendChild(dot);
  });

  const filenameEl = document.createElement("span");
  filenameEl.className = "code-editor__filename";
  filenameEl.textContent = fileLabel;

  header.appendChild(traffic);
  header.appendChild(filenameEl);

  const body = document.createElement("div");
  body.className = "code-editor__body";

  const surface = document.createElement("div");
  surface.className = "code-editor__monaco";
  surface.setAttribute("aria-label", `Code editor for ${fileLabel}`);
  body.appendChild(surface);

  const statusBar = document.createElement("div");
  statusBar.className = "code-editor__statusbar";
  const runtimeSpan = document.createElement("span");
  runtimeSpan.textContent = "Python 3.11";
  const fileSpan = document.createElement("span");
  fileSpan.textContent = fileLabel;
  const positionSpan = document.createElement("span");
  positionSpan.textContent = "Ln 1, Col 1";
  statusBar.append(runtimeSpan, fileSpan, positionSpan);

  textarea.parentNode.replaceChild(wrapper, textarea);
  wrapper.appendChild(header);
  wrapper.appendChild(body);
  wrapper.appendChild(statusBar);

  const editor = monaco.editor.create(surface, {
    value: initialValue,
    language: "python",
    theme: MONACO_THEME,
    automaticLayout: true,
    minimap: { enabled: false },
    fontFamily: "'JetBrains Mono', Consolas, 'Fira Code', monospace",
    fontSize: 15,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    padding: { top: 12, bottom: 18 },
  });

  const updatePosition = (position) => {
    if (!positionSpan || !position) return;
    positionSpan.textContent = `Ln ${position.lineNumber}, Col ${position.column}`;
  };

  editor.onDidChangeModelContent(() => {
    onChange?.(editor.getValue());
    updatePosition(editor.getPosition());
  });

  editor.onDidChangeCursorPosition((event) => updatePosition(event.position));
  updatePosition(editor.getPosition());

  return {
    getValue: () => editor.getValue(),
    focus: () => editor.focus(),
  };
}

