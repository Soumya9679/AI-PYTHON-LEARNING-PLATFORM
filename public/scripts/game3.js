const playerCar = document.getElementById("player-car");
const rivalCar = document.getElementById("rival-car");
const progressFill = document.getElementById("progress-fill");
const lapEl = document.getElementById("lap");
const streakEl = document.getElementById("streak");
const penaltyEl = document.getElementById("penalties");
const statusBanner = document.getElementById("status-banner");
const conceptPill = document.getElementById("concept-pill");
const questionCount = document.getElementById("question-count");
const codeSnippet = document.getElementById("code-snippet");
const promptText = document.getElementById("prompt-text");
const optionsContainer = document.getElementById("options");
const hintBtn = document.getElementById("hint-btn");
const nextBtn = document.getElementById("next-btn");
const hintText = document.getElementById("hint-text");
const telemetryFeed = document.getElementById("telemetry-feed");
const playerDistanceEl = document.getElementById("player-distance");
const rivalDistanceEl = document.getElementById("rival-distance");
const positionCallout = document.getElementById("position-callout");
const speedFill = document.getElementById("speed-fill");
const speedValue = document.getElementById("speed-value");

const rivalConfig = {
    baseVelocity: 0.55,
    accel: 0.02,
    maxVelocity: 1.45,
    interval: 800
};

const questionBank = [
    {
        concept: "Stride slicing",
        snippet: "grid = [9, 7, 5, 3, 1]\nprint(grid[0:5:2])",
        prompt: "Select the exact output.",
        options: ["[9, 5, 1]", "[7, 3]", "[9, 7, 5]", "[5, 3, 1]"],
        answer: 0,
        tip: "A step of 2 hops every other element."
    },
    {
        concept: "Negative slicing",
        snippet: "word = 'velocity'\nprint(word[-4:-1])",
        prompt: "What hits stdout?",
        options: ["cit", "oci", "loc", "ity"],
        answer: 0,
        tip: "Slices stop just before the end index."
    },
    {
        concept: "Star unpack",
        snippet: "a, *mid, z = [2, 4, 6, 8, 10]\nprint(sum(mid))",
        prompt: "Choose the printed sum.",
        options: ["12", "14", "18", "24"],
        answer: 2,
        tip: "mid collects everything between the first and last items."
    },
    {
        concept: "Dict comprehension",
        snippet: "laps = {'neo': 68, 'aya': 64, 'raj': 70}\ntrimmed = {k: v-60 for k, v in laps.items() if v > 65}\nprint(sum(trimmed.values()))",
        prompt: "What total do we see?",
        options: ["18", "20", "13", "8"],
        answer: 0,
        tip: "Only entries over 65 survive the filter."
    },
    {
        concept: "Range stepping",
        snippet: "total = 0\nfor n in range(3, 15, 4):\n    total += n\nprint(total)",
        prompt: "Pick the correct total.",
        options: ["18", "21", "24", "27"],
        answer: 1,
        tip: "range(3, 15, 4) emits 3, 7, 11."
    },
    {
        concept: "Filtered reverse",
        snippet: "pulse = [3, 4, 5, 6]\nrhythm = [x for x in pulse if x % 2 == 0]\nprint(rhythm[::-1])",
        prompt: "What prints?",
        options: ["[4, 6]", "[6, 4]", "[3, 5]", "[6]"],
        answer: 1,
        tip: "Filter even numbers, then reverse the list."
    },
    {
        concept: "Set uniqueness",
        snippet: "codes = {c.lower() for c in 'PyPy33!'}\nprint(len(codes))",
        prompt: "Select the length.",
        options: ["4", "5", "3", "6"],
        answer: 0,
        tip: "Duplicates vanish regardless of case."
    },
    {
        concept: "Formatting",
        snippet: "gap = 3/8\nprint(f\"{gap:.3f}\")",
        prompt: "Choose the exact string.",
        options: ["0.375", "0.38", "0.37", "0.3"],
        answer: 0,
        tip: ".3f keeps three decimals."
    },
    {
        concept: "Mutable defaults",
        snippet: "def queue(batch=[]):\n    batch.append(len(batch))\n    return batch\n\nfirst = queue()\nsecond = queue()\nprint(second)",
        prompt: "What is printed?",
        options: ["[0, 1]", "[0]", "[1, 2]", "[0, 1, 2]"],
        answer: 0,
        tip: "Default lists persist between calls."
    },
    {
        concept: "Zip + min",
        snippet: "drivers = ['Asha', 'Liam', 'Mina']\nsectors = [31.2, 30.8, 32.1]\nboard = dict(zip(drivers, sectors))\nfast = min(board, key=board.get)\nprint(fast)",
        prompt: "Who tops the board?",
        options: ["Liam", "Asha", "Mina", "Raises KeyError"],
        answer: 0,
        tip: "min with key compares the mapped values."
    },
    {
        concept: "Enumerate start",
        snippet: "calls = ['box', 'lift', 'deploy']\nfor idx, word in enumerate(calls, start=5):\n    if idx == 6:\n        print(word.upper())",
        prompt: "Which line is emitted?",
        options: ["LIFT", "BOX", "DEPLOY", "Nothing prints"],
        answer: 0,
        tip: "Starting at 5 makes the second word index 6."
    },
    {
        concept: "Generator sum",
        snippet: "boost = sum(n for n in range(5) if n % 2)\nprint(boost)",
        prompt: "Select the output.",
        options: ["4", "6", "8", "9"],
        answer: 0,
        tip: "Only 1 and 3 make it into the sum."
    },
    {
        concept: "any vs all",
        snippet: "flags = [True, False, True]\nprint(any(flags) and not all(flags))",
        prompt: "Choose the boolean result.",
        options: ["True", "False", "None", "Raises TypeError"],
        answer: 0,
        tip: "At least one True but not every value is True."
    },
    {
        concept: "Sorting tuples",
        snippet: "laps = [(71, 'Kai'), (69, 'Noor'), (69, 'Ivy')]\nleader = sorted(laps)[0][1]\nprint(leader)",
        prompt: "Who leads?",
        options: ["Ivy", "Noor", "Kai", "(69, 'Ivy')"],
        answer: 0,
        tip: "Tuples sort by time then driver name."
    },
    {
        concept: "Dict get fallback",
        snippet: "telemetry = {'temp': 92}\nprint(telemetry.get('boost') or 27)",
        prompt: "What prints?",
        options: ["27", "None", "KeyError", "92"],
        answer: 0,
        tip: "Missing key yields None which triggers the fallback."
    }
];

const state = {
    deck: [],
    index: 0,
    distance: 0,
    rivalDistance: 0,
    streak: 0,
    penalties: 0,
    finished: false,
    readyNext: false,
    speed: 80,
    result: null,
    rivalVelocity: 0
};

let rivalLoop;

hintBtn.addEventListener("click", handleHint);
nextBtn.addEventListener("click", handleNext);

function initGame() {
    state.deck = shuffle([...questionBank]);
    state.index = 0;
    state.distance = 0;
    state.rivalDistance = 0;
    state.streak = 0;
    state.penalties = 0;
    state.finished = false;
    state.readyNext = false;
    state.speed = 80;
    state.result = null;
    state.rivalVelocity = rivalConfig.baseVelocity;
    hintBtn.disabled = false;
    nextBtn.disabled = true;
    nextBtn.textContent = "Next challenge";
    hintText.textContent = "";
    telemetryFeed.innerHTML = "";
    pushTelemetry("Diagnostics loaded. Launch when ready.");
    setBanner("Systems nominal");
    updateStats();
    updateTrack();
    renderQuestion();
    startRivalLoop();
}

function startRivalLoop() {
    if (rivalLoop) {
        clearInterval(rivalLoop);
    }
    rivalLoop = setInterval(() => {
        if (state.finished) {
            return;
        }
        const jitter = 0.85 + Math.random() * 0.3;
        state.rivalDistance = Math.min(100, state.rivalDistance + state.rivalVelocity * jitter);
        state.rivalVelocity = Math.min(rivalConfig.maxVelocity, state.rivalVelocity + rivalConfig.accel);
        updateStats();
        updateTrack();
        checkVictory();
    }, rivalConfig.interval);
}

function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function renderQuestion() {
    const question = state.deck[state.index];
    conceptPill.textContent = question.concept;
    questionCount.textContent = `Challenge ${String(state.index + 1).padStart(2, "0")}`;
    codeSnippet.textContent = question.snippet;
    promptText.textContent = question.prompt;
    hintText.textContent = "";
    optionsContainer.innerHTML = "";

    const optionBag = question.options.map((text, idx) => ({
        text,
        isCorrect: idx === question.answer
    }));

    shuffle(optionBag).forEach(option => {
        const button = document.createElement("button");
        button.textContent = option.text;
        button.dataset.correct = option.isCorrect ? "true" : "false";
        button.addEventListener("click", () => handleAnswer(button));
        optionsContainer.appendChild(button);
    });
}

function handleAnswer(selectedButton) {
    if (state.readyNext || state.finished) {
        return;
    }

    const question = state.deck[state.index];
    const buttons = Array.from(optionsContainer.querySelectorAll("button"));
    buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.correct === "true") {
            btn.classList.add("correct");
        }
    });

    const isCorrect = selectedButton.dataset.correct === "true";
    if (!isCorrect) {
        selectedButton.classList.add("incorrect");
    }

    state.readyNext = true;
    nextBtn.disabled = false;
    hintBtn.disabled = true;

    if (isCorrect) {
        const boost = 12 + Math.min(state.streak * 2, 8);
        state.distance = Math.min(100, state.distance + boost);
        state.streak += 1;
        state.speed = Math.min(220, state.speed + 18);
        state.rivalDistance = Math.max(0, state.rivalDistance - 2);
        setBanner("Perfect exit. Boost engaged.");
        pushTelemetry(`+${boost}m | ${question.concept} mastered`, "success");
    } else {
        state.distance = Math.max(0, state.distance - 8);
        state.streak = 0;
        state.penalties += 1;
        state.speed = Math.max(60, state.speed - 20);
        setBanner("Incorrect call. Grip lost.");
        pushTelemetry("-8m drag | " + question.concept, "fail");
    }

    updateStats();
    updateTrack();
    checkVictory();
}

function handleNext() {
    if (state.finished) {
        initGame();
        return;
    }

    if (!state.readyNext) {
        return;
    }

    state.readyNext = false;
    nextBtn.disabled = true;
    hintBtn.disabled = false;

    state.index += 1;
    if (state.index >= state.deck.length) {
        state.deck = shuffle([...questionBank]);
        state.index = 0;
    }

    renderQuestion();
}

function handleHint() {
    const tip = state.deck[state.index].tip;
    hintText.textContent = tip;
    hintBtn.disabled = true;
    pushTelemetry("Hint deployed: " + tip);
}

function updateStats() {
    const lap = Math.floor(state.distance / 25) + 1;
    lapEl.textContent = String(Math.min(lap, 4)).padStart(2, "0");
    streakEl.textContent = state.streak;
    penaltyEl.textContent = state.penalties;
    playerDistanceEl.textContent = `${Math.round(state.distance)}m`;
    rivalDistanceEl.textContent = `${Math.round(state.rivalDistance)}m`;
    updatePositionCallout();
    updateSpeedGauge();
}

function updateTrack() {
    progressFill.style.width = `${state.distance}%`;
    playerCar.style.setProperty("--car-x", `${state.distance}%`);
    rivalCar.style.setProperty("--car-x", `${state.rivalDistance}%`);
}

function setBanner(text) {
    statusBanner.textContent = text;
}

function checkVictory() {
    if (state.finished) {
        return;
    }

    if (state.distance >= 100) {
        finishRace("win");
    } else if (state.rivalDistance >= 100) {
        finishRace("loss");
    }
}

function finishRace(result) {
    state.finished = true;
    state.readyNext = true;
    state.result = result;
    nextBtn.disabled = false;
    nextBtn.textContent = "Restart race";
    hintBtn.disabled = true;
    disableOptionButtons();

    if (result === "win") {
        setBanner("🏁 Velocity achieved! Cool-down lap unlocked.");
        pushTelemetry("Finish line crossed in style.", "success");
        positionCallout.textContent = "P1 • Lap complete";
        positionCallout.style.background = "rgba(53, 255, 177, 0.15)";
        positionCallout.style.borderColor = "rgba(53, 255, 177, 0.6)";
    } else {
        setBanner("Rival claimed the podium.");
        pushTelemetry("Autopilot rival hit finish first.", "fail");
        positionCallout.textContent = "P2 • Rework strategy";
        positionCallout.style.background = "rgba(255, 77, 109, 0.15)";
        positionCallout.style.borderColor = "rgba(255, 77, 109, 0.6)";
    }

    if (rivalLoop) {
        clearInterval(rivalLoop);
    }
}

function disableOptionButtons() {
    Array.from(optionsContainer.querySelectorAll("button")).forEach(btn => {
        btn.disabled = true;
    });
}

function updatePositionCallout() {
    if (state.finished && state.result) {
        return;
    }
    const leading = state.distance >= state.rivalDistance;
    positionCallout.textContent = leading ? "Leading the pack" : "Chasing the rival";
    positionCallout.style.background = leading ? "rgba(53, 255, 177, 0.12)" : "rgba(255, 191, 63, 0.15)";
    positionCallout.style.borderColor = leading ? "rgba(53, 255, 177, 0.4)" : "rgba(255, 191, 63, 0.45)";
}

function updateSpeedGauge() {
    const minSpeed = 60;
    const maxSpeed = 220;
    const clamped = Math.max(minSpeed, Math.min(maxSpeed, state.speed));
    const percent = ((clamped - minSpeed) / (maxSpeed - minSpeed)) * 100;
    speedFill.style.width = `${percent}%`;
    speedValue.textContent = `${Math.round(clamped)} km/h`;
}

function pushTelemetry(message, type = "info") {
    const entry = document.createElement("li");
    entry.textContent = message;
    if (type === "success") {
        entry.classList.add("success");
    }
    if (type === "fail") {
        entry.classList.add("fail");
    }
    telemetryFeed.prepend(entry);
    while (telemetryFeed.children.length > 5) {
        telemetryFeed.removeChild(telemetryFeed.lastChild);
    }
}

initGame();

