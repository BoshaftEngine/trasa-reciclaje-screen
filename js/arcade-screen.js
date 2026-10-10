import {drawZona,ZONA_W,ZONA_H} from "./arcade-zona.js?v=11";
import { loadFirebase, roomPath, isFirebaseConfigured } from "./common.js";
import { MATERIALS } from "./materials.js?v=2";
import { readLive, safeState, scoreRanking, ARCADE_GAMES } from "./arcade-common.js?v=10";
import { drawRunScene, RUN_W, RUN_H } from "./arcade-run.js?v=8";

const arcadeView = document.getElementById("arcadeView");
const activePlayer = document.getElementById("arcadeFeaturedName");
const stage = document.getElementById("arcadeStage");
const liveRoster = document.getElementById("arcadePlayers");
const memoryRank = document.getElementById("arcadeMemoryRank");
const runRank = document.getElementById("arcadeRunRank");
const zonaRank = document.getElementById("arcadeZonaRank");
const gameLink = document.getElementById("arcadeGameUrl");
const gameLinkText = new URL("juego.html", document.baseURI).href;
gameLink.textContent = gameLinkText;

const imageFor = Object.fromEntries(MATERIALS.map(m => [m.id, m.image]));
const nameFor = Object.fromEntries(MATERIALS.map(m => [m.id, m.name]));
let screenDisplay = {};
let livePlayers = [];
let rawLivePlayers = {};
let runSpectator = null;
let runSpectatorFrame = null;
let zonaSpectator = null;
let zonaSpectatorFrame = null;

function buildRanking(target, items) {
  target.replaceChildren();
  const ranking = scoreRanking(items);
  if (!ranking.length) {
    const empty = document.createElement("div");
    empty.className = "arcade-muted";
    empty.textContent = "Todavía no hay récords";
    target.append(empty);
    return;
  }
  ranking.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "arcade-rank-row";
    const n = document.createElement("span");
    n.textContent = `${index + 1}. ${player.name}`;
    const score = document.createElement("strong");
    score.textContent = String(player.score);
    row.append(n, score);
    target.append(row);
  });
}

function renderRoster() {
  liveRoster.replaceChildren();
  if (!livePlayers.length) {
    liveRoster.textContent = "Esperando jugadores…";
    return;
  }
  const featured = screenDisplay.featuredUid || livePlayers[0].uid;
  for (const p of livePlayers.slice(0, 7)) {
    const row = document.createElement("div");
    row.className = `arcade-player-row ${p.uid === featured ? "is-featured" : ""}`;
    const name = document.createElement("span");
    name.textContent = `${p.uid === featured ? "▶ " : ""}${p.name} · ${ARCADE_GAMES.find(g => g.id === p.gameId)?.short || p.gameId}`;
    const score = document.createElement("strong");
    score.textContent = `${p.score} pt`;
    row.append(name, score);
    liveRoster.append(row);
  }
}

function memoryStage(player, state) {
  const group = document.createElement("div");
  group.className = "arcade-memory-stage";
  const info = document.createElement("div");
  info.className = "arcade-stage-meta";
  info.textContent = `PUNTOS: ${player.score}  ·  PAREJAS: ${(state.matched || []).length / 2}  ·  TIEMPO: ${Math.max(0, state.timeLeft || 0)} s`;
  group.append(info);
  const board = document.createElement("div");
  board.className = "arcade-spectator-cards";
  (state.board || []).forEach((id, index) => {
    const card = document.createElement("div");
    const shown = (state.open || []).includes(index) || (state.matched || []).includes(index);
    card.className = `arcade-spectator-card ${shown ? "is-visible" : ""}`;
    if (shown && imageFor[id]) {
      const image = document.createElement("img");
      image.src = imageFor[id];
      image.alt = nameFor[id];
      card.append(image);
    } else {
      card.textContent = "?";
    }
    board.append(card);
  });
  group.append(board);
  return group;
}

function stopRunSpectator() {
  if (runSpectatorFrame !== null) cancelAnimationFrame(runSpectatorFrame);
  runSpectatorFrame = null;
  runSpectator = null;
}

function animateRunSpectator() {
  if (!runSpectator) return;
  const s = runSpectator;
  const delay = Math.min(.7, Math.max(0, (performance.now() - s.receivedAt) / 1000));
  const scene = { ...s.state,
    distance: (Number(s.state.distance) || 0) + (Number(s.state.speed) || 0) * delay,
    time: (Number(s.state.time) || 0) + delay,
    obstacles: (s.state.obstacles || []).map(o => ({
      ...o, x: Number(o.x) - (Number(s.state.speed) || 0) * delay
    }))
  };
  // Predicción visual del salto entre paquetes de red.
  if (Number(s.state.y) < 223 || Number(s.state.vy)) {
    scene.y = Math.min(223, Number(s.state.y) + Number(s.state.vy || 0) * delay + 925 * delay * delay);
  }
  drawRunScene(s.canvas, scene);
  runSpectatorFrame = requestAnimationFrame(animateRunSpectator);
}

function runStage(player, state) {
  let wrapper;
  if (!runSpectator || runSpectator.uid !== player.uid) {
    stopRunSpectator();
    stage.replaceChildren();
    stage.dataset.content = "run";
    wrapper = document.createElement("div");
    wrapper.className = "arcade-run-stage";
    const info = document.createElement("div");
    info.className = "arcade-stage-meta";
    const canvas = document.createElement("canvas");
    canvas.className = "arcade-run-canvas";
    canvas.width = RUN_W;
    canvas.height = RUN_H;
    wrapper.append(info, canvas);
    stage.append(wrapper);
    runSpectator = { uid: player.uid, canvas, info, state, receivedAt: performance.now() };
    runSpectatorFrame = requestAnimationFrame(animateRunSpectator);
  } else {
    runSpectator.state = state;
    runSpectator.receivedAt = performance.now();
  }
  runSpectator.info.textContent = `PUNTOS: ${player.score}  ·  SOBREVIVIENDO: ${Math.round(state.time || 0)} s`;
}

function stopZonaSpectator(){
  if(zonaSpectatorFrame!==null)cancelAnimationFrame(zonaSpectatorFrame);
  zonaSpectatorFrame=null;zonaSpectator=null;
}
function animateZonaSpectator(t){
  if(!zonaSpectator)return;
  const s=zonaSpectator;
  // Interpolamos entre paquetes Firebase con 450 ms de retraso;
  // no enviamos fotogramas ni vídeo a Firebase.
  if(!s.lastPaint||t-s.lastPaint>=50){
    const u=Math.max(0,Math.min(1,(t-s.receivedAt)/450));
    const to=s.current;
    const from=(s.previous?.seed===to.seed && s.previous?.level===to.level)?s.previous:to;
    const pose={...to,
      x:Number(from.x)+(Number(to.x)-Number(from.x))*u,
      y:Number(from.y)+(Number(to.y)-Number(from.y))*u,
      a:Number(from.a)+Math.atan2(Math.sin(Number(to.a)-Number(from.a)),Math.cos(Number(to.a)-Number(from.a)))*u,
      enemies:(to.enemies||[]).map((e,i)=>({
        ...e,x:Number(from.enemies?.[i]?.x??e.x)+(Number(e.x)-Number(from.enemies?.[i]?.x??e.x))*u,
        y:Number(from.enemies?.[i]?.y??e.y)+(Number(e.y)-Number(from.enemies?.[i]?.y??e.y))*u
      }))
    };
    drawZona(s.canvas,pose);s.lastPaint=t;
  }
  zonaSpectatorFrame=requestAnimationFrame(animateZonaSpectator);
}
function zonaStage(player,state){
  if(!zonaSpectator||zonaSpectator.uid!==player.uid){
    stopZonaSpectator();stage.replaceChildren();stage.dataset.content="zona";
    const holder=document.createElement("div");holder.className="zona-stage";
    const info=document.createElement("div");info.className="arcade-stage-meta";
    const canvas=document.createElement("canvas");canvas.className="zona-canvas";canvas.width=ZONA_W;canvas.height=ZONA_H;
    holder.append(info,canvas);stage.append(holder);
    zonaSpectator={uid:player.uid,canvas,info,current:state,previous:state,receivedAt:performance.now(),lastPaint:0};
    zonaSpectatorFrame=requestAnimationFrame(animateZonaSpectator);
  }else{
    zonaSpectator.previous=zonaSpectator.current;zonaSpectator.current=state;
    zonaSpectator.receivedAt=performance.now();
  }
  zonaSpectator.info.textContent=`NIVEL ${state.level||1}/3 · PUNTOS: ${player.score} · ♻ ${state.materials||0}/${state.need||4} · SALUD: ${state.health||0} · ${state.remaining||0} s`;
}

function renderStage() {
  if (screenDisplay.mode !== "arcade") {
    stopRunSpectator();stopZonaSpectator();
    return;
  }
  const requested = livePlayers.find(p => p.uid === screenDisplay.featuredUid);
  const current = requested || livePlayers[0];
  if (!current) {
    stopRunSpectator();stopZonaSpectator();
    activePlayer.textContent = "ESPERANDO JUGADORES";

    // No reconstruir el QR si la sala sigue vacía: evita parpadeos.
    if (stage.dataset.content !== "join-lobby") {
      stage.replaceChildren();
      const waiting = document.createElement("div");
      waiting.className = "arcade-empty-stage arcade-join-lobby";

      const title = document.createElement("div");
      title.className = "arcade-join-lobby-title";
      title.textContent = "ESCANEA PARA JUGAR";

      const qr = document.createElement("img");
      qr.className = "arcade-join-lobby-qr";
      qr.src = "assets/qr-trasa-arcade.png";
      qr.alt = "Código QR para abrir TRASA Arcade";
      qr.width = 256;
      qr.height = 256;

      const text = document.createElement("p");
      text.textContent = "ABRE EL ENLACE EN TU MÓVIL Y ELIGE UN MINIJUEGO";

      waiting.append(title, qr, text);
      stage.append(waiting);
      stage.dataset.content = "join-lobby";
    }
    return;
  }
  activePlayer.textContent = `${current.name.toUpperCase()} · ${current.gameId === "memory" ? "MEMORY" : current.gameId === "zona" ? "ZONA CONTAMINADA" : "TRASA RUN"}`;
  const state = safeState(current.state);
  if (current.gameId === "run") {
    stopZonaSpectator();runStage(current, state);
    return;
  }
  if (current.gameId === "zona") {
    stopRunSpectator();zonaStage(current,state);
    return;
  }
  stopRunSpectator();stopZonaSpectator();
  stage.replaceChildren();
  stage.dataset.content = "memory";
  stage.append(memoryStage(current, state));
}

function redraw() {
  livePlayers = readLive(rawLivePlayers);
  renderStage();
  renderRoster();
}

async function init() {
  if (!isFirebaseConfigured()) return;
  try {
    const f = await loadFirebase();
    await f.authMod.signInAnonymously(f.auth);
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("display")), snap => {
      screenDisplay = snap.val() || {};
      arcadeView.classList.toggle("hidden", screenDisplay.mode !== "arcade");
      redraw();
    });
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/live")), snap => {
      rawLivePlayers = snap.val() || {};
      redraw();
    });
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/scores/memory")), snap => buildRanking(memoryRank, snap.val()));
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/scores/run")), snap => buildRanking(runRank, snap.val()));
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/scores/zona")), snap => buildRanking(zonaRank, snap.val()));
    // Actualiza el estado de los jugadores inactivos aunque no lleguen escrituras nuevas.
    setInterval(() => { if (!arcadeView.classList.contains("hidden")) redraw(); }, 12000);
  } catch (error) {
    console.error("TRASA Arcade:", error);
  }
}
init();
