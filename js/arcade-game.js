import {createZona, stepZona, shootZona, interactZona, packZonaState, drawZona, ZONA_W, ZONA_H} from "./arcade-zona.js?v=1";
import {mountZonaInput} from "./zona-input.js?v=1";
import { MATERIALS } from "./materials.js?v=2";
import { loadFirebase, roomPath, isFirebaseConfigured } from "./common.js";
import { GAME_DURATION, shuffle, cleanName } from "./arcade-common.js?v=10";
import { createRun, stepRun, jumpRun, duckRun, packRunState, drawRunScene, RUN_W, RUN_H } from "./arcade-run.js?v=8";

const $ = id => document.getElementById(id);
const nickInput = $("nickname");
const memoryBtn = $("startMemory");
const runBtn = $("startRun");
const zonaBtn = $("startZona");
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
let blocked = false;
let session = null;
let timer = null;
let memoryTimeout = null;
let lastLiveWrite = 0;
let liveWrite = Promise.resolve();
let liveBusy = false;
let runFrame = null;
let runPreviousTime = 0;
let runCanvas = null;
let zonaCanvas = null;
let zonaInput = null;
const matById = Object.fromEntries(MATERIALS.map(m => [m.id, m]));

try { nickInput.value = localStorage.getItem("trasa-arcade-nick") || ""; } catch {}

function notice(text) { roomStatus.textContent = text; }
function enableButtons() {
  const enabled = Boolean(firebase && roomOpen && !session && !blocked);
  memoryBtn.disabled = !enabled;
  runBtn.disabled = !enabled;
  zonaBtn.disabled = !enabled;
}

function clearTimers() {
  clearInterval(timer);
  clearTimeout(memoryTimeout);
  zonaInput?.destroy(); zonaInput = null; zonaCanvas = null;
  cancelAnimationFrame(runFrame);
  runFrame = null;
  runCanvas = null;
  timer = null;
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
  if (session.gameId === "zona") return packZonaState(session.zona);
  if (session.gameId === "memory") {
    return {
      board: session.board,
      open: session.open,
      matched: session.matched,
      timeLeft: secondsLeft()
    };
  }
  return {};
}

function syncLive(force = false, status = "playing") {
  if (!firebase || !session || blocked) return Promise.resolve();
  const delay = session.gameId === "run" ? 450 : session.gameId === "zona" ? 350 : 1600;
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
  if (!firebase || !session || blocked) return;
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
  if (!firebase || !session || blocked) return;
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
  if (!session || session.finished || blocked) return;
  session.finished = true;
  clearTimers();
  if (reason === "completed" && session.gameId === "memory") session.score += secondsLeft();
  scoreNow();
  gameRoot.classList.add("hidden");
  endBlock.classList.remove("hidden");
  endScore.textContent = String(session.score);
  endText.textContent = session.gameId === "run"
    ? "¡Buen recorrido! Tu puntuación queda registrada en el TOP de TRASA RUN."
    : session.gameId === "zona"
      ? (reason === "completed" ? "¡Planta evacuada! Tu puntuación se guarda en el TOP de Zona Contaminada." : "Misión fallida. Los materiales recuperados y robots desactivados también puntúan.")
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
  if (!session || session.gameId !== "memory" || session.finished || session.locked || !roomOpen || blocked) return;
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

/* ============================================================
   TRASA RUN — salta obstáculos en el suelo o agáchate ante bolsas
   voladoras. Los controles de agacharse se mantienen pulsados.
   El lienzo local anima a 60 fps y el proyector recibe ~2 estados/s.
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
  const actions = document.createElement("div");
  actions.className = "arcade-run-action-buttons";
  const jumpButton = document.createElement("button");
  jumpButton.type = "button";
  jumpButton.textContent = "⬆ SALTAR";
  jumpButton.addEventListener("pointerdown", event => {
    event.preventDefault();
    jumpFromPlayer();
  });
  const duckButton = document.createElement("button");
  duckButton.type = "button";
  duckButton.className = "arcade-run-duck-button";
  duckButton.textContent = "⬇ AGACHARSE";
  duckButton.setAttribute("aria-label", "Mantén pulsado para agacharte bajo las bolsas voladoras");
  duckButton.addEventListener("pointerdown", event => {
    event.preventDefault();
    duckButton.setPointerCapture(event.pointerId);
    duckFromPlayer(true);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    duckButton.addEventListener(eventName, () => duckFromPlayer(false));
  }
  const hint = document.createElement("span");
  hint.textContent = "SALTAR: ESPACIO / ↑ / W · AGACHARSE: ↓ / S (MANTENER) · MÓVIL: BOTONES";
  actions.append(jumpButton, duckButton);
  controls.append(actions, hint);
  container.append(canvas, controls);
  gameRoot.append(container);
  runCanvas = canvas;
  drawRunScene(runCanvas, session.runner);
  scoreNow();
}

function jumpFromPlayer() {
  if (!session || session.gameId !== "run" || session.finished || !roomOpen || blocked) return;
  if (jumpRun(session.runner)) syncLive(true);
}

function duckFromPlayer(pressed) {
  if (!session || session.gameId !== "run" || session.finished) return;
  duckRun(session.runner, pressed);
  syncLive(true);
}

window.addEventListener("keydown", event => {
  if (!session || session.gameId !== "run" || session.finished || !roomOpen || blocked) return;
  if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
    event.preventDefault();
    if (!event.repeat) jumpFromPlayer();
  } else if (["ArrowDown", "KeyS"].includes(event.code)) {
    event.preventDefault();
    if (!session.runner.ducking) duckFromPlayer(true);
  }
});

window.addEventListener("keyup", event => {
  if (["ArrowDown", "KeyS"].includes(event.code)) duckFromPlayer(false);
});

window.addEventListener("blur", () => duckFromPlayer(false));

function runAnimation(timestamp) {
  if (!session || session.gameId !== "run" || session.finished || !roomOpen || blocked) return;
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

/* ZONA CONTAMINADA: misma simulación en el navegador, estados compactos en Firebase. */
function renderZona(){
  gameRoot.replaceChildren();
  const holder=document.createElement("div");holder.className="zona-game";
  const hint=document.createElement("p");hint.className="zona-instructions";
  hint.textContent="WASD: moverte · Flechas/Q: girar · Arrastrar: mirar · Espacio: disparar · E: usar salida · M: mapa";
  const canvas=document.createElement("canvas");canvas.className="zona-canvas";canvas.width=ZONA_W;canvas.height=ZONA_H;
  holder.append(hint,canvas);gameRoot.append(holder);zonaCanvas=canvas;
  zonaInput=mountZonaInput(holder,canvas,
    ()=>{if(session?.gameId==="zona"&&!session.finished){shootZona(session.zona);syncLive(true);}},
    ()=>{if(session?.gameId==="zona"&&!session.finished){interactZona(session.zona);syncLive(true);}},
    ()=>{if(session?.gameId==="zona"&&!session.finished)session.zona.showMap=!session.zona.showMap;});
  drawZona(canvas,packZonaState(session.zona));scoreNow();
}
function zonaAnimation(timestamp){
  if(!session||session.gameId!=="zona"||session.finished||!roomOpen||blocked)return;
  const dt=runPreviousTime?(timestamp-runPreviousTime)/1000:0;runPreviousTime=timestamp;
  stepZona(session.zona,dt,zonaInput?.read());
  session.zona.remaining=Math.min(session.zona.remaining,secondsLeft());
  if(session.zona.remaining<=0)session.zona.lost=true;
  session.score=session.zona.score;
  if(zonaCanvas)drawZona(zonaCanvas,packZonaState(session.zona),{flash:session.zona.flash>0});
  scoreNow();
  if(session.zona.won||session.zona.lost){finishGame(session.zona.won?"completed":"failed");return;}
  syncLive();runFrame=requestAnimationFrame(zonaAnimation);
}

function startGame(gameId) {
  if (!firebase || !roomOpen || session || blocked) return;
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
  } else if (gameId === "zona") {
    session.zona = createZona();
  }
  title.textContent = gameId === "memory" ? "MEMORY DE MATERIALES" : gameId === "zona" ? "TRASA: ZONA CONTAMINADA" : "TRASA RUN";
  lobby.classList.add("hidden");
  playArea.classList.remove("hidden");
  gameRoot.classList.remove("hidden");
  endBlock.classList.add("hidden");
  if (gameId === "memory") { renderMemory(); syncLive(true); }
  else if (gameId === "run") {
    runPreviousTime = 0;
    renderRun();
    syncLive(true);
    runFrame = requestAnimationFrame(runAnimation);
  } else if (gameId === "zona") {
    runPreviousTime=0;
    renderZona();syncLive(true);
    runFrame=requestAnimationFrame(zonaAnimation);
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
  runBtn.onclick = () => startGame("run");
  zonaBtn.onclick = () => startGame("zona");
  restartBtn.onclick = backToGames;
  enableButtons();
  if (!isFirebaseConfigured()) { notice("Firebase todavía no está configurado."); return; }
  try {
    firebase = await loadFirebase();
    const account = await firebase.authMod.signInAnonymously(firebase.auth);
    uid = account.user.uid;
    // Si CONTROL expulsa y bloquea esta sesión, se detiene de inmediato.
    firebase.dbMod.onValue(
      firebase.dbMod.ref(firebase.db, roomPath(`arcade/bans/${uid}`)),
      snap => {
        blocked = snap.exists();
        if (blocked) {
          clearTimers();
          session = null;
          playArea.classList.add("hidden");
          lobby.classList.remove("hidden");
          notice("Tu sesión no puede participar en TRASA Arcade.");
        } else {
          notice(roomOpen ? "SALA ABIERTA · ¡Puedes jugar!" : "SALA CERRADA · Esperando a TRASA.");
        }
        enableButtons();
      }
    );
    // Cuando CONTROL borra todos los resultados, también cierra las partidas en marcha.
    firebase.dbMod.onValue(
      firebase.dbMod.ref(firebase.db, roomPath("arcade/resetAt")),
      snap => {
        const resetAt = Number(snap.val() || 0);
        if (session && !session.finished && resetAt >= session.startedAt) {
          clearTimers();
          session = null;
          playArea.classList.add("hidden");
          lobby.classList.remove("hidden");
          notice("TRASA ha reiniciado los registros. Puedes empezar otra partida.");
          enableButtons();
        }
      }
    );
    firebase.dbMod.onValue(firebase.dbMod.ref(firebase.db, roomPath("display")), snap => {
      roomOpen = (snap.val() || {}).mode === "arcade";
      if (!roomOpen && session && !session.finished) {
        // El control de TRASA puede cerrar la sala o mostrar materiales en cualquier momento.
        clearTimers();
        session = null;
        playArea.classList.add("hidden");
        lobby.classList.remove("hidden");
      }
      if (!blocked) notice(roomOpen ? "SALA ABIERTA · ¡Puedes jugar!" : "SALA CERRADA · Esperando a que TRASA active Arcade.");
      enableButtons();
    });
    // Identifica la sesión que sigue abierta en la sala para que no desaparezca del proyector.
    setInterval(() => {
      if (session && !session.finished && roomOpen) syncLive(true);
    }, 7000);
  } catch (error) { notice(`No se pudo conectar Firebase: ${error.message}`); }
}
init();
