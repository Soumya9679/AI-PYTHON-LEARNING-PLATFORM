import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.mjs";

const challenge = {
  id: "loop-basics",
  tag: "Quest · Beginner",
  title: "Make Byte wave three times",
  description:
    "Use a loop to print a short status message for each wave. Keep the format identical on each line.",
  criteria: "You should see exactly three lines that increment from 0 to 2.",
  mentorInstructions: "Give 1-2 upbeat hints, point out mistakes, never share final code.",
  rubric: "Learner must print 'PulsePy >>>' followed by 0, 1, 2 on separate lines using a loop.",
  steps: [
    "Create a for loop that runs three times",
    "Inside the loop, print the label `PulsePy >>>` and the current counter",
    "Keep the spacing and capitalization consistent",
  ],
  starterCode: `# Print PulsePy >>> 0, 1, 2 using a loop\nfor wave in range(3):\n    print("PulsePy >>>", wave)` ,
  expectedOutput: "PulsePy >>> 0\nPulsePy >>> 1\nPulsePy >>> 2",
  retryHelp: "Aim for three lines, each ending with the numbers 0, 1, and 2 respectively.",
};

const runButton = document.getElementById("runCode");
const outputText = document.getElementById("outputText");
const outputStatus = document.getElementById("outputStatus");
const feedbackMessage = document.getElementById("feedbackMessage");
const fallbackTextarea = document.getElementById("editorFallback");
const editorSurface = document.getElementById("editorSurface");
const resizeHandle = document.getElementById("editorResizeHandle");
const hintButton = document.getElementById("hintButton");
const mentorCard = document.getElementById("mentorCard");
const mentorCopy = document.getElementById("mentorCopy");
const mentorTone = document.getElementById("mentorTone");

const challengeTag = document.getElementById("challengeTag");
const challengeTitle = document.getElementById("challengeTitle");
const challengeDescription = document.getElementById("challengeDescription");
const challengeCriteria = document.getElementById("challengeCriteria");
const challengeSteps = document.getElementById("challengeSteps");

let editorInstance;
let lastUserOutput = "Run your code to see output here.";
let lastErrorContext = "";

function populateChallengeDetails() {
  if (challengeTag) challengeTag.textContent = challenge.tag;
  if (challengeTitle) challengeTitle.textContent = challenge.title;
  if (challengeDescription) challengeDescription.textContent = challenge.description;
  if (challengeCriteria) challengeCriteria.textContent = challenge.criteria;
  if (challengeSteps) {
    challengeSteps.innerHTML = "";
    challenge.steps.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      challengeSteps.appendChild(li);
    });
  }
  if (fallbackTextarea) {
    fallbackTextarea.value = challenge.starterCode;
  }
}

populateChallengeDetails();

const monacoLoaderPromise = loadMonacoEditor();
initializeEditor();
setupResizeHandle();

const pyodideRuntimePromise = loadPyRuntime();
const mentorFunctionPromise = initializeFirebaseMentor();

async function loadPyRuntime() {
  try {
    const pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
    });
    await pyodide.runPythonAsync(`
from io import StringIO
import sys, traceback

def pulse_run(source: str):
    stdout = sys.stdout
    stderr = sys.stderr
    out = StringIO()
    err = StringIO()
    result = {"stdout": "", "stderr": "", "error": ""}
    sys.stdout = out
    sys.stderr = err
    try:
        exec(source, {})
    except Exception as exc:
        result["error"] = f"{exc.__class__.__name__}: {exc}"
        err.write(traceback.format_exc())
    finally:
        result["stdout"] = out.getvalue()
        result["stderr"] = err.getvalue()
        sys.stdout = stdout
        sys.stderr = stderr
    return result
`);
    const runner = pyodide.globals.get("pulse_run");
    return { pyodide, runner };
  } catch (error) {
    console.error("Pyodide failed to initialize", error);
    return null;
  }
}

function loadMonacoEditor() {
  const basePath = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min";
  return new Promise((resolve, reject) => {
    if (window.monaco?.editor) {
      resolve(window.monaco);
      return;
    }

    if (window.require) {
      window.require.config({ paths: { vs: `${basePath}/vs` } });
      window.require(["vs/editor/editor.main"], () => {
        if (window.monaco?.editor) {
          resolve(window.monaco);
        } else {
          reject(new Error("Monaco loaded but editor namespace missing"));
        }
      });
      return;
    }

    reject(new Error("Monaco loader was not found on the page"));
  });
}

async function initializeEditor() {
  try {
    const monacoLib = await monacoLoaderPromise;
    editorInstance = monacoLib.editor.create(document.getElementById("editor"), {
      value: challenge.starterCode,
      language: "python",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
    });
    fallbackTextarea?.classList.add("is-hidden");
  } catch (error) {
    console.warn("Monaco failed to initialize, using fallback textarea.", error);
  }
}

function setupResizeHandle() {
  if (!editorSurface || !resizeHandle) return;
  const minHeight = 240;
  let startY = 0;
  let startHeight = editorSurface.offsetHeight;

  function onPointerMove(event) {
    const delta = event.clientY - startY;
    const nextHeight = Math.max(minHeight, startHeight + delta);
    editorSurface.style.minHeight = `${nextHeight}px`;
    editorSurface.style.height = `${nextHeight}px`;
    editorInstance?.layout();
  }

  function onPointerUp(event) {
    resizeHandle.releasePointerCapture(event.pointerId);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  resizeHandle.addEventListener("pointerdown", (event) => {
    startY = event.clientY;
    startHeight = editorSurface.getBoundingClientRect().height;
    resizeHandle.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });
}

function getUserCode() {
  if (editorInstance) {
    return editorInstance.getValue();
  }
  return fallbackTextarea?.value ?? "";
}

async function evaluateSolution(code) {
  if (!code.trim()) {
    return {
      status: "error",
      message: "Type your solution before running.",
      userOutput: "",
    };
  }

  const runtime = await pyodideRuntimePromise;
  if (!runtime) {
    return {
      status: "info",
      message: "Python runtime is still loading. Please try again in a moment.",
      userOutput: lastUserOutput,
    };
  }

  let result;
  try {
    const proxy = runtime.runner(code);
    result = proxy.toJs({ dict_converter: Object.fromEntries });
    proxy.destroy();
  } catch (error) {
    console.error("Runtime error", error);
    return {
      status: "error",
      message: "Something went wrong while running your code. Check your syntax and retry.",
      userOutput: "",
    };
  }

  if (result.error) {
    return {
      status: "error",
      message: `${result.error}. ${generateMentorHint(code, result.error)}`,
      userOutput: result.stdout || result.stderr,
    };
  }

  const normalizedOutput = (result.stdout || "").trim();
  const expected = challenge.expectedOutput.trim();

  if (normalizedOutput === expected) {
    return {
      status: "success",
      message: "Great work! Your output matches the goal. Try remixing the code to explore.",
      userOutput: result.stdout,
    };
  }

  return {
    status: "error",
    message: `Your output doesn't match yet. ${challenge.retryHelp}`,
    userOutput: result.stdout || "(no output captured)",
  };
}

function displayOutput(message, status) {
  outputText.textContent = lastUserOutput || "(no output yet)";
  feedbackMessage.textContent = message;
  outputStatus.className = `status-pill ${status}`;
  const labelMap = { success: "Correct", error: "Needs work", info: "Info" };
  outputStatus.textContent = labelMap[status] ?? "Status";
}

function generateMentorHint(code, errorContext) {
  // Placeholder: later this will call a Gemini-powered backend for contextual hints.
  if (errorContext.includes("NameError")) {
    return "Hint: Double-check your variable names and capitalization.";
  }
  if (errorContext.includes("Syntax")) {
    return "Hint: Look for missing parentheses or colons in your loop.";
  }
  return "Hint: Ensure the loop runs three times and prints the counter each time.";
}

runButton?.addEventListener("click", async () => {
  const code = getUserCode();
  runButton.disabled = true;
  runButton.textContent = "Running…";
  displayOutput("Running code…", "info");

  try {
    const result = await evaluateSolution(code);
    lastUserOutput = result.userOutput;
    lastErrorContext = result.status === "success" ? "" : result.message;
    displayOutput(result.message, result.status);
  } catch (error) {
    console.error(error);
    lastUserOutput = "";
    lastErrorContext = "Unexpected runtime failure";
    displayOutput("Unexpected error. Refresh the page and try again.", "error");
  } finally {
    runButton.disabled = false;
    runButton.textContent = "Run Code";
  }
});

hintButton?.addEventListener("click", async () => {
  hintButton.disabled = true;
  mentorCopy.textContent = "Thinking through your code…";
  mentorTone.textContent = "Status: contacting mentor";

  try {
    const getHint = await mentorFunctionPromise;
    if (!getHint) {
      mentorCopy.textContent = "Mentor isn’t available right now. Compare your output manually for now.";
      mentorTone.textContent = "Status: offline";
      return;
    }

    const payload = {
      code: getUserCode(),
      challengeTitle: challenge.title,
      description: challenge.description,
      rubric: challenge.rubric,
      mentorInstructions: challenge.mentorInstructions,
      stdout: lastUserOutput,
      stderr: lastErrorContext,
      expectedOutput: challenge.expectedOutput,
    };

    const response = await getHint(payload);
    mentorCopy.textContent = response?.hint || "Keep iterating—focus on matching the spacing and count.";
    mentorTone.textContent = `Tone: ${response?.tone ?? "spark"}`;
  } catch (error) {
    console.error("Hint error", error);
    mentorCopy.textContent = "Mentor had a hiccup. Re-run your code and try again in a bit.";
    mentorTone.textContent = "Status: retry later";
  } finally {
    hintButton.disabled = false;
  }
});

async function initializeFirebaseMentor() {
  let firebaseAppMod;
  let firebaseFunctionsMod;

  try {
    firebaseAppMod = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
    firebaseFunctionsMod = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js");
  } catch (error) {
    console.warn("Firebase SDK failed to load", error);
    return null;
  }

  const configMeta = document.querySelector("meta[name='firebase-config']");
  const firebaseConfig = configMeta?.content ? JSON.parse(configMeta.content) : null;

  if (!firebaseConfig) {
    console.warn("Firebase config meta tag missing");
    return null;
  }

  const { initializeApp, getApps, getApp } = firebaseAppMod;
  const { getFunctions, httpsCallable, connectFunctionsEmulator } = firebaseFunctionsMod;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const functionsSdk = getFunctions(app);

  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    connectFunctionsEmulator(functionsSdk, "localhost", 5001);
  }

  return (payload) => httpsCallable(functionsSdk, "mentorHint")(payload);
}
