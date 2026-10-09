import { MATERIALS } from "./materials.js?v=2";
import { loadFirebase, roomPath, isFirebaseConfigured } from "./common.js";
import { GAME_DURATION, RECYCLING_QUESTIONS, shuffle, cleanName } from "./arcade-common.js?v=2";
import { createRun, stepRun, jumpRun, packRunState, drawRunScene, RUN_W, RUN_H } from "./arcade-run.js";

const $ = id => document.getElementById(id);
const nickInput = $("nickname");
const memoryBtn = $("startMemory");
const classifyBtn = $("startClasifica");
const runBtn = $("startRun");
const restartBtn = $("backToGames");
const roomStatus = $("roomStatus");
const lobby = $("arcadeLobby");
const playArea = $("arcadePlayArea");
const title = $("playerGameTitle");
const scoreText = $("playerScore");
const clockText = $("playerClock");
const gameRoot = $("gameRoot");
const endBlock = $("gameEnd");
const endScore = $("endScore");
const endText = $("endText");

let firebase;
let uid = "";
let roomOpen = false;
let session = null;
let timer = null;
let quizTimeout = null;
let memoryTimeout = null;
let lastLiveWrite = 0;
let liveWrite = Promise.resolve();
let liveBusy = false;
let runFrame = null;
let runPreviousTime = 0;
let runCanvas = null;
const matById = Object.fromEntries(MATERIALS.map(m => [m.id, m]));

try { nickInput.value = localStorage.getItem("trasa-arcade-nick") || ""; } catch {}

function notice(text) { roomStatus.textContent = text; }
function enableButtons() {
  const enabled = Boolean(firebase && roomOpen && !session);
  memoryBtn.disabled = !enabled;
  classifyBtn.disabled = !enabled;
  runBtn.disabled = !enabled;
}

function clearTimers() {
  clearInterval(timer);
  clearTimeout(quizTimeout);
  clearTimeout(memoryTimeout);
  cancelAnimationFrame(runFrame);
  runFrame = null;
  runCanvas = null;
  timer = null;
  quizTimeout = null;
  memoryTimeout = null;
}

function secondsLeft() {
  return session ? Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000)) : 0;
}

function scoreNow() {
  scoreText.textContent = `PUNTOS: ${session?.score || 0}`;
  clockText.textContent = session?.gameId === "run"
    ? `SOBREVIVIENDO: ${Math.floor(session.runner?.time || 0)} s`
    : `TIEMPO: ${secondsLeft()} s`;
}

function liveState() {
  if (!session) return {};
  if (session.gameId === "run") return packRunState(session.runner);
  if (session.gameId === "memory") {
    return {
      board: session.board,
      open: session.open,
      matched: session.matched,
      timeLeft: secondsLeft()
    };
  }
  const q = session.questions[session.round] || {};
  return {
    round: session.round,
    icon: q.icon || "♻️",
    item: q.item || "Partida finalizada",
    answer: q.answer || "",
    choices: session.choices || [],
    chosen: session.chosen || "",
    timeLeft: secondsLeft()
  };
}

function syncLive(force = false, status = "playing") {
  if (!firebase || !session) return Promise.resolve();
  const delay = session.gameId === "run" ? 330 : 1600;
  if (!force && (Date.now() - lastLiveWrite < delay || liveBusy)) return Promise.resolve();
  lastLiveWrite = Date.now();
  const snapshot = {
    gameId: session.gameId,
    name: session.name,
    status,
    score: session.score,
    startedAt: session.startedAt,
    updatedAt: firebase.dbMod.serverTimestamp(),
    state: JSON.stringify(liveState())
  };
  const path = firebase.dbMod.ref(firebase.db, roomPath(`arcade/live/${uid}`));
  // Serializa escrituras para que un fotograma antiguo nunca reemplace al estado final.
  liveBusy = true;
  liveWrite = liveWrite.catch(() => {}).then(() => firebase.dbMod.set(path, snapshot))
    .catch(error => { notice(`Error de sincronización: ${error.message}`); })
    .finally(() => { liveBusy = false; });
  return liveWrite;
}

async function saveHistory() {
  if (!firebase || !session) return;
  const historyRef = firebase.dbMod.push(firebase.dbMod.ref(firebase.db, roomPath(`arcade/history/${session.gameId}/${uid}`)));
  try {
    await firebase.dbMod.set(historyRef, {
      name: session.name,
      score: session.score,
      finishedAt: firebase.dbMod.serverTimestamp()
    });
  } catch (error) {
    notice(`No se pudo guardar el historial: ${error.message}`);
  }
}

async function saveHighScore() {
  if (!firebase || !session) return;
  const score = session.score;
  const name = session.name;
  const scoreRef = firebase.dbMod.ref(firebase.db, roomPath(`arcade/scores/${session.gameId}/${uid}`));
  try {
    await firebase.dbMod.runTransaction(scoreRef, current => {
      if (current && Number(current.score || 0) > score) return;
      return { name, score, updatedAt: Date.now() };
    });
  } catch (error) {
    notice(`Partida finalizada; no se pudo guardar récord: ${error.message}`);
  }
}

async function finishGame(reason = "completed") {
  if (!session || session.finished) return;
  session.finished = true;
  clearTimers();
  if (reason === "completed") session.score += secondsLeft();
  scoreNow();
  gameRoot.classList.add("hidden");
  endBlock.classList.remove("hidden");
  endScore.textContent = String(session.score);
  endText.textContent = session.gameId === "run"
    ? "¡Buen recorrido! Tu puntuación queda registrada en el TOP de TRASA RUN."
    : reason === "completed"
      ? "¡Enhorabuena! Tu mejor puntuación queda guardada en el ranking."
      : "Tiempo agotado. Tu mejor puntuación queda guardada en el ranking.";
  await syncLive(true, "finished");
  await saveHighScore();
  await saveHistory();
}

function gameHeader() { scoreNow(); }

function renderMemory() {
  gameRoot.replaceChildren();
  const board = document.createElement("div");
  board.className = "arcade-player-memory";
  session.board.forEach((id, index) => {
    const button = document.createElement("button");
    button.type = "button";
    const revealed = session.open.includes(index) || session.matched.includes(index);
    button.className = `arcade-flip-card ${revealed ? "flipped" : ""} ${session.matched.includes(index) ? "matched" : ""}`;
    button.disabled = session.finished || session.locked || session.matched.includes(index);
    if (revealed) {
      const image = document.createElement("img");
      image.src = matById[id]?.image || "";
      image.alt = matById[id]?.name || id;
      button.append(image);
    } else button.textContent = "?";
    button.onclick = () => flip(index);
    board.append(button);
  });
  gameRoot.append(board);
  gameHeader();
}

function flip(index) {
  if (!session || session.gameId !== "memory" || session.finished || session.locked || !roomOpen) return;
  if (session.open.includes(index) || session.matched.includes(index)) return;
  session.open.push(index);
  if (session.open.length === 2) {
    session.locked = true;
    const [a, b] = session.open;
    if (session.board[a] === session.board[b]) {
      session.matched.push(a, b);
      session.score += 10;
      session.open = [];
      session.locked = false;
      renderMemory();
      syncLive(true);
      if (session.matched.length === session.board.length) finishGame("completed");
      return;
    }
    renderMemory();
    syncLive(true);
    memoryTimeout = setTimeout(() => {
      if (!session || session.finished) return;
      session.open = [];
      session.locked = false;
      renderMemory();
      syncLive(true);
    }, 1100);
  } else {
    renderMemory();
    syncLive(true);
  }
}

function nextQuizQuestion() {
  if (!session || session.gameId !== "clasifica" || session.finished) return;
  if (session.round >= session.questions.length) {
    finishGame("completed");
    return;
  }
  const answer = session.questions[session.round].answer;
  session.choices = shuffle([answer, ...shuffle(MATERIALS.filter(m => m.id !== answer).map(m => m.id)).slice(0, 3)]);
  session.chosen = "";
  session.locked = false;
  renderQuiz();
  syncLive(true);
}

function renderQuiz() {
  gameRoot.replaceChildren();
  const q = session.questions[session.round];
  const wrapper = document.createElement("div");
  wrapper.className = "arcade-player-quiz";
  const counter = document.createElement("div");
  counter.className = "arcade-player-quiz-round";
  counter.textContent = `PREGUNTA ${session.round + 1} / ${session.questions.length}`;
  const emoji = document.createElement("div");
  emoji.className = "arcade-player-quiz-icon";
  emoji.textContent = q.icon;
  const prompt = document.createElement("h2");
  prompt.textContent = q.item;
  const explain = document.createElement("p");
  explain.textContent = "¿Qué material corresponde a este residuo?";
  const options = document.createElement("div");
  options.className = "arcade-player-quiz-choices";
  for (const id of session.choices) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = matById[id]?.name || id;
    b.disabled = session.locked;
    b.className = `arcade-answer-btn ${session.chosen === id ? (id === q.answer ? "good" : "bad") : ""}`;
    b.onclick = () => answerQuiz(id);
    options.append(b);
  }
  wrapper.append(counter, emoji, prompt, explain, options);
  gameRoot.append(wrapper);
  gameHeader();
}

function answerQuiz(id) {
  if (!session || session.gameId !== "clasifica" || session.finished || session.locked || !roomOpen) return;
  session.locked = true;
  session.chosen = id;
  if (id === session.questions[session.round].answer) session.score += 10;
  renderQuiz();
  syncLive(true);
  quizTimeout = setTimeout(() => {
    if (!session || session.finished) return;
    session.round++;
    nextQuizQuestion();
  }, 1200);
}


/* ============================================================
   TRASA RUN — el trabajador salta obstáculos en una pista sin fin.
   El lienzo local anima a 60 fps y el proyector recibe 3 estados/s.
   ============================================================ */
function renderRun() {
  gameRoot.replaceChildren();
  const container = document.createElement("div");
  container.className = "arcade-run-game";
  const canvas = document.createElement("canvas");
  canvas.className = "arcade-run-canvas";
  canvas.width = RUN_W;
  canvas.height = RUN_H;
  canvas.setAttribute("aria-label", "Trabajador TRASA saltando obstáculos");
  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    jumpFromPlayer();
  });
  const controls = document.createElement("div");
  controls.className = "arcade-run-controls";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "⬆ SALTAR";
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    jumpFromPlayer();
  });
  const hint = document.createElement("span");
  hint.textContent = "ORDENADOR: ESPACIO / ↑ / W · MÓVIL: TOCA LA PANTALLA";
  controls.append(button, hint);
  container.append(canvas, controls);
  gameRoot.append(container);
  runCanvas = canvas;
  drawRunScene(runCanvas, session.runner);
  scoreNow();
}

function jumpFromPlayer() {
  if (!session || session.gameId !== "run" || session.finished || !roomOpen) return;
  if (jumpRun(session.runner)) syncLive(true);
}

window.addEventListener("keydown", event => {
  if (!session || session.gameId !== "run" || session.finished || !roomOpen || event.repeat) return;
  if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
    event.preventDefault();
    jumpFromPlayer();
  }
});

function runAnimation(timestamp) {
  if (!session || session.gameId !== "run" || session.finished || !roomOpen) return;
  const delta = runPreviousTime ? (timestamp - runPreviousTime) / 1000 : 0;
  runPreviousTime = timestamp;
  stepRun(session.runner, delta);
  session.score = session.runner.score;
  if (runCanvas) drawRunScene(runCanvas, session.runner);
  scoreNow();
  if (session.runner.lost) {
    if (runCanvas) drawRunScene(runCanvas, session.runner, { gameOver: true, score: session.score });
    finishGame("collision");
    return;
  }
  syncLive();
  runFrame = requestAnimationFrame(runAnimation);
}

function startGame(gameId) {
  if (!firebase || !roomOpen || session) return;
  const nick = cleanName(nickInput.value);
  if (nick.length < 2) {
    notice("Escribe un nombre de al menos 2 caracteres.");
    nickInput.focus();
    return;
  }
  try { localStorage.setItem("trasa-arcade-nick", nick); } catch {}

  const now = Date.now();
  session = {
    gameId, name: nick, score: 0, startedAt: now,
    endsAt: gameId === "run" ? Infinity : now + GAME_DURATION[gameId] * 1000,
    locked: false, finished: false
  };
  if (gameId === "memory") {
    const selected = shuffle(MATERIALS).slice(0, Math.min(6, MATERIALS.length)).map(m => m.id);
    session.board = shuffle([...selected, ...selected]);
    session.open = [];
    session.matched = [];
  } else if (gameId === "run") {
    session.runner = createRun();
  } else {
    session.questions = shuffle(RECYCLING_QUESTIONS.filter(q => matById[q.answer])).slice(0, 10);
    session.round = 0;
    session.choices = [];
    session.chosen = "";
  }
  title.textContent = gameId === "memory" ? "MEMORY DE MATERIALES"
    : gameId === "clasifica" ? "CLASIFICA RESIDUOS" : "TRASA RUN";
  lobby.classList.add("hidden");
  playArea.classList.remove("hidden");
  gameRoot.classList.remove("hidden");
  endBlock.classList.add("hidden");
  if (gameId === "memory") { renderMemory(); syncLive(true); }
  else if (gameId === "clasifica") nextQuizQuestion();
  else {
    runPreviousTime = 0;
    renderRun();
    syncLive(true);
    runFrame = requestAnimationFrame(runAnimation);
  }
  timer = setInterval(() => {
    if (!session || session.finished) return;
    scoreNow();
    if (session.gameId !== "run") {
      if (secondsLeft() <= 0) { finishGame("timeout"); return; }
      syncLive();
    }
  }, 1000);
  enableButtons();
}

function backToGames() {
  if (session && !session.finished) return;
  session = null;
  clearTimers();
  playArea.classList.add("hidden");
  lobby.classList.remove("hidden");
  enableButtons();
}

async function init() {
  memoryBtn.onclick = () => startGame("memory");
  classifyBtn.onclick = () => startGame("clasifica");
  runBtn.onclick = () => startGame("run");
  restartBtn.onclick = backToGames;
  enableButtons();
  if (!isFirebaseConfigured()) { notice("Firebase todavía no está configurado."); return; }
  try {
    firebase = await loadFirebase();
    const account = await firebase.authMod.signInAnonymously(firebase.auth);
    uid = account.user.uid;
    firebase.dbMod.onValue(firebase.dbMod.ref(firebase.db, roomPath("display")), snap => {
      roomOpen = (snap.val() || {}).mode === "arcade";
      if (!roomOpen && session && !session.finished) {
        // El control de TRASA puede cerrar la sala o mostrar materiales en cualquier momento.
        clearTimers();
        session = null;
        playArea.classList.add("hidden");
        lobby.classList.remove("hidden");
      }
      notice(roomOpen ? "SALA ABIERTA · ¡Puedes jugar!" : "SALA CERRADA · Esperando a que TRASA active Arcade.");
      enableButtons();
    });
    // Identifica la sesión que sigue abierta en la sala para que no desaparezca del proyector.
    setInterval(() => {
      if (session && !session.finished && roomOpen) syncLive(true);
    }, 7000);
  } catch (error) { notice(`No se pudo conectar Firebase: ${error.message}`); }
}
init();
