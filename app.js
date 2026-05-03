const DEFAULT_TIMER_SECONDS = 180;
const LOSS_COOLDOWN_SECONDS = 60;
const STATS_KEY = "addiction_breaker_stats";
const SESSION_GATE_KEY = "ambient_session_allowed";
const SESSION_STATE_KEY = "ambient_session_state";
const LOSS_COOLDOWN_KEY = "ambient_loss_cooldown";
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
  const supportActions = document.querySelector(".support-actions");
  const sessionCard = document.querySelector(".session-card");
  const musicBtn = document.getElementById("music-btn");
  const tipsBtn = document.getElementById("tips-btn");
  const meditationBtn = document.getElementById("meditation-btn");
  const resultOverlay = document.getElementById("result-overlay");
  const winBtn = document.getElementById("win-btn");
  const loseBtn = document.getElementById("lose-btn");
  const progressRing = document.getElementById("session-progress-value");
  const progressCircumference = 2 * Math.PI * 94;
  let resultHandled = false;

  // Force the quote block to center even when mobile Safari holds onto older CSS.
  supportText.style.textAlign = "center";
  supportText.style.display = "block";
  supportText.style.width = "100%";
  if (supportActions && sessionNav) {
    const dockStyles = window.getComputedStyle(sessionNav);
    supportActions.style.background = dockStyles.background;
    supportActions.style.borderRadius = dockStyles.borderRadius;
    supportActions.style.boxShadow = dockStyles.boxShadow;
    supportActions.style.backdropFilter = dockStyles.backdropFilter;
    supportActions.style.webkitBackdropFilter = dockStyles.backdropFilter;
    supportActions.style.borderTop = "0";
    supportActions.style.borderLeft = "0";
    supportActions.style.borderRight = "0";
    supportActions.style.borderBottom = "1px solid rgba(18, 20, 23, 0.08)";
  }
  if (sessionCard) {
    sessionCard.style.position = "absolute";
    sessionCard.style.left = "0";
    sessionCard.style.right = "0";
    sessionCard.style.bottom = "0";
    sessionCard.style.width = "100%";
    sessionCard.style.marginTop = "0";
  }

  let timerId = null;
  let secondsRemaining = DEFAULT_TIMER_SECONDS;
  let expiryTime = null;
  let isReturningFromModal = false;
  let shouldOpenOverlayImmediately = false;

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
        shouldOpenOverlayImmediately = true;
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

  function updateProgressRing(remainingSeconds) {
    if (!progressRing) return;
    const progress = Math.max(0, Math.min(1, remainingSeconds / DEFAULT_TIMER_SECONDS));
    progressRing.style.strokeDashoffset = String(progressCircumference * (1 - progress));
  }

  function resetToSessionState() {
    clearInterval(timerId);
    timerId = null;
    secondsRemaining = DEFAULT_TIMER_SECONDS;
    expiryTime = null;
    timerDisplay.textContent = formatTime(secondsRemaining);
    updateProgressRing(secondsRemaining);
    supportText.textContent = "You are safe. Let the urge pass through.";
    resultOverlay.classList.remove("is-visible");
    resultOverlay.classList.add("hidden");
    if (sessionNav) sessionNav.classList.add("hidden");
  }

  function startTimer() {
    if (timerId !== null) return;
    timerDisplay.textContent = formatTime(secondsRemaining);
    updateProgressRing(secondsRemaining);
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
      updateProgressRing(secondsRemaining);

      if (secondsRemaining <= 0) {
        clearInterval(timerId);
        timerId = null;
        showResultOverlay();
      }
    }, 1000);
  }

  function recordWin() {
    if (resultHandled) return;
    resultHandled = true;
    const stats = loadStats();
    stats.wins += 1;
    stats.totalUrgeFreeSeconds += DEFAULT_TIMER_SECONDS;
    stats.currentStreak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    saveStats(stats);
    sessionStorage.removeItem(SESSION_GATE_KEY);
    window.location.assign("win.html");
  }

  function recordLoss() {
    if (resultHandled) return;
    resultHandled = true;
    const stats = loadStats();
    stats.losses += 1;
    stats.currentStreak = 0;
    saveStats(stats);
    sessionStorage.removeItem(SESSION_GATE_KEY);
    sessionStorage.setItem(LOSS_COOLDOWN_KEY, JSON.stringify({
      endsAt: Date.now() + LOSS_COOLDOWN_SECONDS * 1000,
      reflection: ""
    }));
    window.location.assign("lose.html");
  }

  function bindResultAction(button, handler) {
    if (!button) return;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      handler();
    });
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

  bindResultAction(winBtn, recordWin);
  bindResultAction(loseBtn, recordLoss);

  if (shouldOpenOverlayImmediately) {
    timerDisplay.textContent = formatTime(0);
    updateProgressRing(0);
    showResultOverlay();
    return;
  }

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
  updateProgressRing(secondsRemaining);
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

function initSupportReveal() {
  if (!document.querySelector(".support-screen")) return;

  const revealNodes = Array.from(document.querySelectorAll(".reveal-card"));
  const focusCards = Array.from(document.querySelectorAll(".support-focus-card"));
  const scrollContainers = Array.from(document.querySelectorAll(".support-screen .support-panel, .support-panel-meditation .support-sequence"));
  if (revealNodes.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    revealNodes.forEach((node) => node.classList.add("is-visible"));
    if (focusCards[0]) {
      focusCards[0].classList.add("is-revealed");
    }
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.2,
    rootMargin: "0px 0px -8% 0px"
  });

  revealNodes.forEach((node) => {
    if (node.classList.contains("support-focus-card")) {
      node.classList.add("is-visible");
      return;
    }
    if (node.classList.contains("is-visible")) return;
    observer.observe(node);
  });

  if (focusCards[0]) {
    focusCards[0].classList.add("is-revealed");
  }

  const assignCardToContainer = (card) => {
    return scrollContainers.find((container) => container.contains(card)) || null;
  };

  const observers = new Map();

  focusCards.forEach((card) => {
    const container = assignCardToContainer(card);
    const observerKey = container || document.body;

    if (!observers.has(observerKey)) {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        });
      }, {
        root: container,
        threshold: 0.35,
        rootMargin: "0px 0px -18% 0px"
      });

      observers.set(observerKey, revealObserver);
    }

    const revealObserver = observers.get(observerKey);
    if (card.classList.contains("is-revealed")) return;
    revealObserver.observe(card);
  });
}

function initLosePage() {
  const timerNode = document.getElementById("cooldown-timer");
  if (!timerNode) return;
  if (!isAuthenticated()) {
    window.location.href = "login.html";
    return;
  }

  const savedCooldown = sessionStorage.getItem(LOSS_COOLDOWN_KEY);
  if (!savedCooldown) {
    window.location.href = "index.html";
    return;
  }

  const progressRing = document.getElementById("cooldown-progress-value");
  const reflectionNode = document.getElementById("cooldown-reflection");
  const hintNode = document.getElementById("cooldown-hint");
  const exitBtn = document.getElementById("cooldown-exit");
  const progressCircumference = 2 * Math.PI * 94;

  let cooldown = null;
  let cooldownEnded = false;
  let timerId = null;

  try {
    cooldown = JSON.parse(savedCooldown);
  } catch (_error) {
    sessionStorage.removeItem(LOSS_COOLDOWN_KEY);
    window.location.href = "index.html";
    return;
  }

  if (!cooldown || typeof cooldown.endsAt !== "number") {
    sessionStorage.removeItem(LOSS_COOLDOWN_KEY);
    window.location.href = "index.html";
    return;
  }

  reflectionNode.value = typeof cooldown.reflection === "string" ? cooldown.reflection : "";

  function saveCooldownState() {
    sessionStorage.setItem(LOSS_COOLDOWN_KEY, JSON.stringify({
      endsAt: cooldown.endsAt,
      reflection: reflectionNode.value.trim()
    }));
  }

  function updateProgressRing(remainingSeconds) {
    if (!progressRing) return;
    const progress = Math.max(0, Math.min(1, remainingSeconds / LOSS_COOLDOWN_SECONDS));
    progressRing.style.strokeDasharray = String(progressCircumference);
    progressRing.style.strokeDashoffset = String(progressCircumference * (1 - progress));
  }

  function updateExitState() {
    const hasReflection = reflectionNode.value.trim().length > 0;
    const unlocked = cooldownEnded && hasReflection;
    exitBtn.disabled = !unlocked;
    hintNode.textContent = unlocked
      ? "You can leave now."
      : cooldownEnded
        ? "Leave one honest reflection to continue."
        : "The button unlocks when the timer ends and you leave a reflection.";
  }

  function completeCooldown() {
    cooldownEnded = true;
    timerNode.textContent = "0:00";
    updateProgressRing(0);
    updateExitState();
  }

  function tick() {
    const remainingSeconds = Math.max(0, Math.ceil((cooldown.endsAt - Date.now()) / 1000));
    timerNode.textContent = formatTime(remainingSeconds);
    updateProgressRing(remainingSeconds);

    if (remainingSeconds <= 0) {
      clearInterval(timerId);
      timerId = null;
      completeCooldown();
    }
  }

  reflectionNode.addEventListener("input", () => {
    saveCooldownState();
    updateExitState();
  });

  exitBtn.addEventListener("click", () => {
    if (exitBtn.disabled) return;
    sessionStorage.removeItem(LOSS_COOLDOWN_KEY);
    window.location.href = "index.html";
  });

  if (Date.now() >= cooldown.endsAt) {
    completeCooldown();
  } else {
    updateProgressRing(Math.max(0, Math.ceil((cooldown.endsAt - Date.now()) / 1000)));
    tick();
    timerId = setInterval(tick, 1000);
  }

  updateExitState();
}

initHomePage();
initSessionPage();
initInfoPage();
initModalPage();
initSupportReveal();
initLoginPage();
initLosePage();
