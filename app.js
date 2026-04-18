const STATES = {
    'ACTION_1': {
        title: 'ACTION 1',
        text: "Preheat the oven to 450F with the empty dutch oven inside, and the pizza stone on the bottom rack",
        buttonImg: "temperature.png",
        characterImg: "eyes_open.png",
        nextState: 'WAIT_1'
    },
    'WAIT_1': {
        title: 'WAITING...',
        text: "Preheating... (30 min)",
        buttonImg: "temperature.png",
        timerSeconds: 10, // Reduced for testing
        characterImg: "eyes_star.png", // Fixed: was eyes_stars.png (typo)
        nextState: 'ACTION_2',
        isWait: true
    },
    'ACTION_2': {
        title: 'ACTION 2',
        text: "Score the bread, spray it, put it in, close the lid!",
        buttonImg: "dutch.png",
        characterImg: "eyes_open.png",
        nextState: 'WAIT_2'
    },
    'WAIT_2': {
        title: 'WAITING...',
        text: "Great, now we wait a bit before scoring the ears",
        buttonImg: "dutch.png",
        timerSeconds: 20,
        characterImg: "eyes_star.png", // Fixed: was eyes_stars.png (typo)
        nextState: 'ACTION_3',
        isWait: true
    },
    'ACTION_3': {
        title: 'ACTION 3',
        text: "Score those ears at a 45 degree angle! Lid back on and continue baking",
        buttonImg: "knife.png",
        characterImg: "eyes_open.png",
        nextState: 'WAIT_3'
    },
    'WAIT_3': {
        title: 'WAITING...',
        text: "Baking with lid on... (13 min)",
        buttonImg: "knife.png",
        timerSeconds: 13,
        characterImg: "eyes_star.png", // Fixed: was eyes_stars.png (typo)
        nextState: 'ACTION_4',
        isWait: true
    },
    'ACTION_4': {
        title: 'ACTION 4',
        text: "Time to lower the temperature to 400F and open bake",
        buttonImg: "boule.png",
        characterImg: "eyes_open.png",
        nextState: 'WAIT_4'
    },
    'WAIT_4': {
        title: 'WAITING...',
        text: "Open baking... (20 min)",
        buttonImg: "boule.png",
        timerSeconds: 20,
        characterImg: "eyes_star.png", // Fixed: was eyes_stars.png (typo)
        nextState: 'ACTION_5',
        isWait: true
    },
    'ACTION_5': {
        title: 'ACTION 5',
        text: "Final check. Knock the bottom, is it ready?",
        buttonImg: "boule.png",
        characterImg: "eyes_open.png",
        nextState: 'CELEBRATION'
    }
};

let currentState = 'START';
let timerEnd = null;
let timerInterval = null;
let timerTimeout = null; // Tier 2: page-owned background timeout for SW notification
let typewriterInterval = null;
let typewriterSessionId = 0;

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const celebrationScreen = document.getElementById('celebration-screen');
const restartModal = document.getElementById('restart-modal');

const stateTitle = document.getElementById('state-title');
const timerDisplay = document.getElementById('timer-display');
const characterImg = document.getElementById('character-img');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const actionOverlay = document.getElementById('action-overlay');
const actionLabel = document.getElementById('action-label');
const speechText = document.getElementById('speech-text');

const timerSound = document.getElementById('timer-sound');
const celebrationSound = document.getElementById('celebration-sound');
const clickSound = document.getElementById('click-sound');

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function init() {
    const savedState = localStorage.getItem('sourdough_game_state');
    if (savedState && savedState !== 'START') {
        currentState = savedState;
        showScreen('game-screen');
        resumeTimer();
    } else {
        showScreen('start-screen');
    }

    document.getElementById('start-screen').addEventListener('click', startBake);
    document.getElementById('restart-btn').addEventListener('click', () => {
        playSound(clickSound);
        restartModal.classList.remove('hidden');
    });
    document.getElementById('confirm-yes').addEventListener('click', restartGame);
    document.getElementById('confirm-no').addEventListener('click', () => {
        playSound(clickSound);
        restartModal.classList.add('hidden');
    });
    actionBtn.addEventListener('click', handleAction);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(registration => {
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('New content is available; please refresh.');
                            } else {
                                console.log('Content is cached for offline use.');
                            }
                        }
                    };
                }
            };
        }).catch(err => console.log('SW failed', err));
    }
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

function startBake() {
    [timerSound, celebrationSound, clickSound].forEach(s => {
        s.play().then(() => { s.pause(); s.currentTime = 0; }).catch(() => {});
    });

    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    currentState = 'ACTION_1';
    localStorage.setItem('sourdough_game_state', currentState);
    showScreen('game-screen');
    updateUI();
}

function updateUI() {
    const config = STATES[currentState];
    if (!config) {
        console.error("No config found for state:", currentState);
        return;
    }

    console.log("Updating UI for state:", currentState, "isWait:", config.isWait);

    stateTitle.textContent = config.title;
    characterImg.src = config.characterImg;
    actionIcon.src = config.buttonImg;

    characterImg.onerror = () => characterImg.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentState}`;
    actionIcon.onerror = () => actionIcon.src = `https://picsum.photos/seed/${currentState}/200/200`;

    if (config.isWait) {
        actionBtn.disabled = true;
        actionOverlay.classList.remove('hidden');
        actionLabel.textContent = 'WAITING...';
        timerDisplay.style.color = 'var(--color-timer-green, #00ff00)';
    } else {
        actionBtn.disabled = false;
        actionOverlay.classList.add('hidden');
        actionLabel.textContent = 'TAP TO ACTION';
        timerDisplay.style.color = 'var(--color-timer)';
        timerDisplay.textContent = '00:00';
    }

    typewriter(speechText, config.text);
}

function handleAction() {
    playSound(clickSound);
    const config = STATES[currentState];
    if (config && !config.isWait) {
        transitionTo(config.nextState);
    }
}

function transitionTo(next) {
    currentState = next;
    localStorage.setItem('sourdough_game_state', currentState);

    if (currentState === 'CELEBRATION') {
        startCelebration();
    } else {
        updateUI();
        if (STATES[currentState].isWait) {
            startTimer(STATES[currentState].timerSeconds);
        }
    }
}

// ---------------------------------------------------------------------------
// Timer — Tier 2 + Tier 3
//
// Tier 2: The PAGE owns the setTimeout. When it fires, it posts NOTIFY to
//         the SW which shows the notification. This is more reliable than
//         a SW-owned setTimeout because the page's JS isn't subject to
//         the SW lifetime limits.
//
// Tier 3: endTime is persisted in localStorage. On refresh/reopen,
//         resumeTimer() reads it and either continues the countdown or
//         fires immediately if the timer already expired.
// ---------------------------------------------------------------------------

function startTimer(seconds) {
    clearPageTimer(); // Clear any existing background timeout

    const now = Date.now();
    timerEnd = now + (seconds * 1000);
    localStorage.setItem('sourdough_timer_end', timerEnd);
    console.log("Timer started for", seconds, "seconds. Ends at", timerEnd);

    schedulePageTimer(timerEnd);
    runTimer();
}

function resumeTimer() {
    const savedEnd = localStorage.getItem('sourdough_timer_end');
    const config = STATES[currentState];

    if (savedEnd && config && config.isWait) {
        timerEnd = parseInt(savedEnd, 10);
        const now = Date.now();
        console.log("Resuming timer. Now:", now, "End:", timerEnd);

        if (timerEnd > now) {
            updateUI();
            schedulePageTimer(timerEnd); // Re-arm the background timeout after refresh
            runTimer();
        } else {
            console.log("Saved timer already expired, completing now.");
            handleTimerComplete();
        }
    } else {
        localStorage.removeItem('sourdough_timer_end');
        timerEnd = null;
        if (timerInterval) clearInterval(timerInterval);
        console.log("No active wait state or timer to resume.");
        updateUI();
    }
}

// Schedules a page-side setTimeout that posts NOTIFY to the SW when it fires.
// This is the Tier 2 improvement: timing lives in the page, SW just notifies.
function schedulePageTimer(endTime) {
    clearPageTimer();

    const delay = endTime - Date.now();
    if (delay <= 0) return;

    timerTimeout = setTimeout(() => {
        postToSW({
            type: 'NOTIFY',
            message: "Timer finished! Time for the next step."
        });
    }, delay);
}

function clearPageTimer() {
    if (timerTimeout) {
        clearTimeout(timerTimeout);
        timerTimeout = null;
    }
}

// Posts a message to the SW controller, waiting for it to be ready if needed
function postToSW(message) {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
        if (reg.active) {
            reg.active.postMessage(message);
        }
    }).catch(err => console.warn('[SW] postMessage failed:', err));
}

function runTimer() {
    if (timerInterval) clearInterval(timerInterval);

    const update = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((timerEnd - now) / 1000));

        const m = Math.floor(remaining / 60).toString().padStart(2, '0');
        const s = (remaining % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${m}:${s}`;

        if (remaining === 0) {
            if (timerInterval) clearInterval(timerInterval);
            handleTimerComplete();
        }
    };

    update();
    timerInterval = setInterval(update, 1000);
}

function handleTimerComplete() {
    localStorage.removeItem('sourdough_timer_end');
    timerEnd = null;
    clearPageTimer(); // Ensure background timeout is cleared too

    try { playSound(timerSound); } catch (e) { console.warn("Sound play failed", e); }
    try { notify("Timer finished! Time for the next step."); } catch (e) { console.warn("Notification failed", e); }

    const config = STATES[currentState];
    if (config && config.isWait) {
        console.log("Timer complete, transitioning from", currentState, "to", config.nextState);
        transitionTo(config.nextState);
    } else {
        console.log("Timer complete but current state is not a wait state:", currentState);
        updateUI();
    }
}

// ---------------------------------------------------------------------------
// Celebration + Restart
// ---------------------------------------------------------------------------

function startCelebration() {
    showScreen('celebration-screen');
    playSound(celebrationSound);

    let loops = 0;
    celebrationSound.onended = () => {
        loops++;
        if (loops < 2) {
            celebrationSound.play();
        } else {
            restartGame();
        }
    };

    setTimeout(() => {
        if (currentState === 'CELEBRATION') restartGame();
    }, 15000);
}

function restartGame() {
    playSound(clickSound);
    localStorage.removeItem('sourdough_game_state');
    localStorage.removeItem('sourdough_timer_end');
    if (timerInterval) clearInterval(timerInterval);
    if (typewriterInterval) clearInterval(typewriterInterval);
    clearPageTimer();

    // Tell SW to cancel anything pending (no-op currently, future-proofing)
    postToSW({ type: 'CANCEL_TIMER' });

    currentState = 'START';
    restartModal.classList.add('hidden');
    showScreen('start-screen');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typewriter(element, text) {
    const sessionId = ++typewriterSessionId;
    if (typewriterInterval) clearInterval(typewriterInterval);

    element.textContent = '';
    let i = 0;

    typewriterInterval = setInterval(() => {
        if (sessionId !== typewriterSessionId) return;

        if (text[i]) element.textContent += text[i];
        i++;

        if (i >= text.length) {
            clearInterval(typewriterInterval);
            if (sessionId === typewriterSessionId) typewriterInterval = null;
        }
    }, 30);
}

function playSound(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

function notify(msg) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const title = "Sourdough Master";
    const options = {
        body: msg,
        icon: "favicon.ico",
        tag: "sourdough-progress",
        renotify: true, // Fixed: was false, which silently replaced notifications
        vibrate: [200, 100, 200]
    };

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, options);
        });
    } else {
        new Notification(title, options);
    }
}

init();
