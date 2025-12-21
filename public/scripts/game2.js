const tiles = [
    { id: "comment", text: "# Sum the numbers", tip: "Comments start with # and explain intent." },
    { id: "sample", text: "sample = [3, 4, 5]", tip: "Square brackets build list literals." },
    { id: "def", text: "def total(nums):", tip: "Functions start with def and end with a colon." },
    { id: "acc", text: "    acc = 0", tip: "Initialize accumulators before loops." },
    { id: "loop", text: "    for n in nums:", tip: "for iterates directly over items in a list." },
    { id: "add", text: "        acc += n", tip: "+= mutates the accumulator in-place." },
    { id: "ret", text: "    return acc", tip: "return hands back the computed value." },
    { id: "call", text: "print(total(sample))", tip: "Functions are called with parentheses." }
];

const targetOrder = tiles.map(t => t.id).concat("");
let puzzle = [...targetOrder];
let moveCount = 0;
let timerId = null;
let seconds = 0;

const puzzleDiv = document.getElementById("puzzle");
const message = document.getElementById("message");
const moveCountEl = document.getElementById("move-count");
const timerEl = document.getElementById("timer");
const statusPill = document.getElementById("status-pill");
const targetCode = document.getElementById("target-code");
const conceptFeed = document.getElementById("concept-feed");
const hintBtn = document.getElementById("hint-btn");
const shuffleBtn = document.getElementById("shuffle-btn");

shuffleBtn.addEventListener("click", shufflePuzzle);
hintBtn.addEventListener("click", showHint);

function renderTarget() {
    targetCode.textContent = tiles
        .map(t => t.text.replace(/^ {4}/g, "    "))
        .join("\n");
}

function renderFeed() {
    conceptFeed.innerHTML = "";
    tiles.forEach(tile => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${tile.text}</strong>${tile.tip}`;
        conceptFeed.appendChild(li);
    });
}

function renderPuzzle() {
    puzzleDiv.innerHTML = "";
    puzzle.forEach((value, index) => {
        const tileData = tiles.find(t => t.id === value);
        const tile = document.createElement("div");
        tile.className = value === "" ? "tile empty" : "tile";
        tile.innerText = tileData ? tileData.text : "";
        tile.title = tileData ? tileData.tip : "";
        if (value !== "") {
            tile.addEventListener("click", () => moveTile(index));
        }
        puzzleDiv.appendChild(tile);
    });
}

function moveTile(index) {
    const emptyIndex = puzzle.indexOf("");
    const [erow, ecol] = [Math.floor(emptyIndex / 3), emptyIndex % 3];
    const [trow, tcol] = [Math.floor(index / 3), index % 3];
    const isAdjacent = Math.abs(erow - trow) + Math.abs(ecol - tcol) === 1;

    if (isAdjacent) {
        [puzzle[index], puzzle[emptyIndex]] = [puzzle[emptyIndex], puzzle[index]];
        moveCount += 1;
        updateHud();
        renderPuzzle();
        checkWin();
    }
}

function shufflePuzzle() {
    puzzle = generateSolvableShuffle(targetOrder);
    moveCount = 0;
    seconds = 0;
    resetTimer();
    startTimer();
    message.textContent = "Slide tiles to restore the Python flow.";
    statusPill.textContent = "Race in progress";
    statusPill.style.color = "var(--accent)";
    renderPuzzle();
    updateHud();
}

function generateSolvableShuffle(goal) {
    let arr = [...goal];
    do {
        arr = fisherYates([...goal]);
    } while (!isSolvable(arr));
    return arr;
}

function fisherYates(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function isSolvable(arr) {
    const nums = arr
        .map(v => (v === "" ? 0 : tiles.findIndex(t => t.id === v) + 1));
    let inversions = 0;
    for (let i = 0; i < nums.length; i += 1) {
        for (let j = i + 1; j < nums.length; j += 1) {
            if (nums[i] && nums[j] && nums[i] > nums[j]) inversions += 1;
        }
    }
    // 3x3 puzzle solvable if inversions even
    return inversions % 2 === 0;
}

function checkWin() {
    if (arraysEqual(puzzle, targetOrder)) {
        message.textContent = "🏁 Clean run! The code is in the right order.";
        statusPill.textContent = "Flow verified";
        statusPill.style.color = "var(--success)";
        stopTimer();
    }
}

function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

function updateHud() {
    moveCountEl.textContent = moveCount;
}

function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
        seconds += 1;
        timerEl.textContent = formatTime(seconds);
    }, 1000);
}

function resetTimer() {
    stopTimer();
    timerEl.textContent = "00:00";
}

function stopTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

function formatTime(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
}

function showHint() {
    const overlay = document.createElement("div");
    overlay.className = "hint-overlay";
    targetOrder.forEach((id, idx) => {
        const tileData = tiles.find(t => t.id === id);
        const cell = document.createElement("div");
        if (tileData) {
            cell.textContent = `${idx + 1}. ${tileData.text}`;
        }
        overlay.appendChild(cell);
    });
    puzzleDiv.appendChild(overlay);
    hintBtn.disabled = true;
    setTimeout(() => {
        overlay.remove();
        hintBtn.disabled = false;
    }, 2200);
}

renderTarget();
renderFeed();
renderPuzzle();
updateHud();
