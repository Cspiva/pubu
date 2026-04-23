const DEFAULT_TIMER_SECONDS = 180;
const STATS_KEY = "addiction_breaker_stats";
const SESSION_GATE_KEY = "ambient_session_allowed";
const SESSION_STATE_KEY = "ambient_session_state";
const AUTH_KEY = "urge_authenticated";

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === "true";
}

function loadStats() {
  const fallback = {
    wins: 0,
    losses: 0,
    totalUrgeFreeSeconds: 0,
    currentStreak: 0,
    bestStreak: 0
  };

  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch (_error) {
    return fallback;
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function getFallbackMessage() {
  const stats = loadStats();
  const messages = [
    "This feeling usually fades in 90 seconds.",
    "You've got this. Don't restart the cycle.",
    "Breathe. You're stronger than this urge.",
    "Focus on today. Stay present.",
    "Every second counts. Keep going.",
    "This will pass. You will get through it.",
    "You've beaten this before. Do it again.",
    "Name the urge. Don't act on it.",
    "Remember why you started.",
    "The urge is temporary. You are stronger.",
    "Delay, redirect, distract. You know what to do.",
    "One small win at a time.",
    "Your future self will thank you.",
    "This moment will pass.",
    "Stay in the present. You are safe here."
  ];

  if (stats.wins > 0) {
    messages.push(`You've won ${stats.wins} times. Make it ${stats.wins + 1}.`);
  }

  if (stats.currentStreak > 0) {
    messages.push(`You're on a streak of ${stats.currentStreak}. Keep it alive.`);
  }

  return messages[Math.floor(Math.random() * messages.length)];
}

async function getMotivationalMessage() {
  try {
    const response = await fetch("https://zenquotes.io/api/random");
    if (!response.ok) {
      throw new Error("Quote fetch failed");
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0 || !data[0].q) {
      throw new Error("Invalid quote response");
    }

    const quote = data[0].q;
    const author = data[0].a || "ZenQuotes";
    return `${quote} — ${author}`;
  } catch (_error) {
    return getFallbackMessage();
  }
}

function initHomePage() {
  const urgeButton = document.getElementById("urge-button");
  if (!urgeButton) return;
  
  if (!isAuthenticated()) {
    window.location.href = "login.html";
    return;
  }
  
  urgeButton.addEventListener("click", () => {
    sessionStorage.setItem(SESSION_GATE_KEY, "1");
    window.location.href = "session.html";
  });
}

function initLoginPage() {
  const form = document.getElementById("login-form");
  if (!form) return;
  
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    
    if (username && password) {
      sessionStorage.setItem(AUTH_KEY, "true");
      window.location.href = "index.html";
    }
  });
}

function initSessionPage() {
  const timerDisplay = document.getElementById("timer-display");
  if (!timerDisplay) return;
  if (!isAuthenticated()) {
    window.location.href = "login.html";
    return;
  }
  if (sessionStorage.getItem(SESSION_GATE_KEY) !== "1") {
    window.location.href = "index.html";
    return;
  }
  const sessionNav = document.getElementById("session-nav");
  const supportText = document.getElementById("support-text");
  const musicBtn = document.getElementById("music-btn");
  const tipsBtn = document.getElementById("tips-btn");
  const meditationBtn = document.getElementById("meditation-btn");
  const resultOverlay = document.getElementById("result-overlay");
  const winBtn = document.getElementById("win-btn");
  const loseBtn = document.getElementById("lose-btn");

  let timerId = null;
  let secondsRemaining = DEFAULT_TIMER_SECONDS;
  let expiryTime = null;
  let isReturningFromModal = false;

  // Check if we're returning from tips or meditation
  const savedState = sessionStorage.getItem(SESSION_STATE_KEY);
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      expiryTime = state.expiryTime;
      sessionStorage.removeItem(SESSION_STATE_KEY);
      // Calculate remaining time based on current time vs expiry time
      const currentTime = Date.now();
      secondsRemaining = Math.max(0, Math.floor((expiryTime - currentTime) / 1000));
      isReturningFromModal = true;
      if (secondsRemaining <= 0) {
        // Timer already expired while on tips/meditation page
        showResultOverlay();
        return;
      }
    } catch (_error) {
      // If parsing fails, use default
    }
  }

  function showResultOverlay() {
    resultOverlay.classList.remove("hidden");
    requestAnimationFrame(() => {
      resultOverlay.classList.add("is-visible");
    });
    if (sessionNav) sessionNav.classList.remove("hidden");
  }

  function resetToSessionState() {
    clearInterval(timerId);
    timerId = null;
    secondsRemaining = DEFAULT_TIMER_SECONDS;
    expiryTime = null;
    timerDisplay.textContent = formatTime(secondsRemaining);
    supportText.textContent = "You are safe. Let the urge pass through.";
    resultOverlay.classList.remove("is-visible");
    resultOverlay.classList.add("hidden");
    if (sessionNav) sessionNav.classList.add("hidden");
  }

  function startTimer() {
    if (timerId !== null) return;
    timerDisplay.textContent = formatTime(secondsRemaining);
    supportText.textContent = "Checking your quote...";

    getMotivationalMessage().then((msg) => {
      supportText.textContent = msg;
    });

    // Set expiry time if not already set
    if (!expiryTime) {
      expiryTime = Date.now() + secondsRemaining * 1000;
    }

    timerId = setInterval(() => {
      secondsRemaining -= 1;
      timerDisplay.textContent = formatTime(secondsRemaining);

      if (secondsRemaining <= 0) {
        clearInterval(timerId);
        timerId = null;
        showResultOverlay();
      }
    }, 1000);
  }

  function recordWin() {
    const stats = loadStats();
    stats.wins += 1;
    stats.totalUrgeFreeSeconds += DEFAULT_TIMER_SECONDS;
    stats.currentStreak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    saveStats(stats);
    sessionStorage.removeItem(SESSION_GATE_KEY);
    window.location.href = "win.html";
  }

  function recordLoss() {
    const stats = loadStats();
    stats.losses += 1;
    stats.currentStreak = 0;
    saveStats(stats);
    sessionStorage.removeItem(SESSION_GATE_KEY);
    window.location.href = "lose.html";
  }

  musicBtn.addEventListener("click", () => {
    window.open("https://open.spotify.com/search/calm%20meditation%20playlist", "_blank", "noopener");
  });

  tipsBtn.addEventListener("click", () => {
    // Save expiry time before navigating
    sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify({
      expiryTime: expiryTime
    }));
    window.location.href = "tips.html";
  });

  meditationBtn.addEventListener("click", () => {
    // Save expiry time before navigating
    sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify({
      expiryTime: expiryTime
    }));
    window.location.href = "meditation.html";
  });

  winBtn.addEventListener("click", recordWin);
  loseBtn.addEventListener("click", recordLoss);

  // Only reset to session state if not returning from tips/meditation
  if (!isReturningFromModal) {
    resetToSessionState();
    supportText.textContent = "You are safe. Let the urge pass through.";
  } else {
    supportText.textContent = "Checking your quote...";
    getMotivationalMessage().then((msg) => {
      supportText.textContent = msg;
    });
  }
  startTimer();
  timerDisplay.textContent = formatTime(secondsRemaining);
}

function initInfoPage() {
  const winsNode = document.getElementById("stats-wins");
  if (!winsNode) return;
  if (!isAuthenticated()) {
    window.location.href = "login.html";
    return;
  }

  const stats = loadStats();
  document.getElementById("stats-wins").textContent = stats.wins;
  document.getElementById("stats-losses").textContent = stats.losses;
  document.getElementById("stats-streak").textContent = stats.currentStreak;
  document.getElementById("stats-best").textContent = stats.bestStreak;
  document.getElementById("stats-time").textContent = formatTime(stats.totalUrgeFreeSeconds);
}

function initModalPage() {
  const backBtn = document.getElementById("back-btn");
  if (!backBtn) return;
  
  backBtn.addEventListener("click", () => {
    window.location.href = "session.html";
  });
}

initHomePage();
initSessionPage();
initInfoPage();
initModalPage();
initLoginPage();
