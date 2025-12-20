let car = document.getElementById("car");
let position = 0;
let correctAnswer = "";

function loadQuestion() {
    fetch("/question")
        .then(res => res.json())
        .then(data => {
            document.getElementById("question").innerText = data.q;
            correctAnswer = data.a.toLowerCase();
        });
}

function checkAnswer() {
    let userAnswer = document.getElementById("answer").value.toLowerCase();
    let status = document.getElementById("status");

    if (userAnswer === correctAnswer) {
        position += 50;
        status.innerText = "✅ Correct! Car speeds up!";
    } else {
        position -= 20;
        if (position < 0) position = 0;
        status.innerText = "❌ Wrong! Car slows down!";
    }

    car.style.left = position + "px";
    document.getElementById("answer").value = "";

    if (position >= 600) {
        status.innerText = "🏁 YOU WIN THE RACE!";
    } else {
        loadQuestion();
    }
}

loadQuestion();

