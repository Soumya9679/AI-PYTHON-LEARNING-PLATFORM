const questions = [
    {
        q: "What is the output of: print(2 ** 3)?",
        options: ["6", "8", "9", "Error"],
        answer: 1
    },
    {
        q: "Which keyword is used to define a function in Python?",
        options: ["function", "define", "def", "fun"],
        answer: 2
    },
    {
        q: "What is the correct file extension for Python?",
        options: [".pt", ".py", ".python", ".p"],
        answer: 1
    }
];

let current = 0;
let score = 0;
let lives = 3;

const questionEl = document.getElementById("question");
const optionBtns = document.querySelectorAll(".options button");

function loadQuestion() {
    questionEl.textContent = questions[current].q;
    optionBtns.forEach((btn, index) => {
        btn.textContent = questions[current].options[index];
    });
}
function checkAnswer(selected) {


if (selected === questions[current].answer) {
        score += 10;
        alert("✅ Correct! Bug fixed!");
    } else {
        lives -= 1;
        alert("❌ Wrong! Bug escaped!");
    }

    document.getElementById("score").textContent = score;
    document.getElementById("lives").textContent = lives;

    if (lives === 0) {
        alert("💀 Game Over! Final Score: " + score);
        location.reload();
    }
}

function nextQuestion() {
    current++;
    if (current >= questions.length) {
        alert("🏆 You Win! Final Score: " + score);
        location.reload();
    } else {
        loadQuestion();
    }
}

loadQuestion();