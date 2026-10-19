/* TRASA ARCADE V23 — VISOR UNIFICADO
 * Un solo selector, un solo titulo y un unico escenario para los seis juegos.
 * Sustituye a los cuatro espectadores independientes que se pisaban el titulo.
 */
import {drawZona, ZONA_W, ZONA_H} from './arcade-zona.js?v=13';
import {loadFirebase, roomPath, isFirebaseConfigured} from './common.js';
import {MATERIALS} from './materials.js?v=2';
import {readLive, safeState, scoreRanking, ARCADE_GAMES} from './arcade-common.js?v=23';
import {drawRunScene, RUN_W, RUN_H} from './arcade-run.js?v=8';
import {drawSnakeScene, SNAKE_CANVAS} from './arcade-snake.js?v=23';
import {drawInvadersScene, INVADERS_WIDTH, INVADERS_HEIGHT} from './arcade-invaders.js?v=23';
import {drawSudokuScene, formatSudokuTime} from './arcade-sudoku.js?v=23';

const $ = id => document.getElementById(id);
const view = $('arcadeView');
const title = $('arcadeFeaturedName');
const stage = $('arcadeStage');
const roster = $('arcadePlayers');
const link = $('arcadeGameUrl');
const GAME_NAMES = {
  memory: 'MEMORY DE MATERIALES', run: 'TRASA RUN',
  zona: 'ZONA CONTAMINADA', snake: 'TRASA SNAKE',
  invaders: 'TRASA INVADERS', sudoku: 'TRASA SUDOKU'
};
const RANK_IDS = {
  memory: 'arcadeMemoryRank', run: 'arcadeRunRank',
  zona: 'arcadeZonaRank', snake: 'arcadeSnakeRank',
  invaders: 'arcadeInvadersRank', sudoku: 'arcadeSudokuRank'
};
const materialImages = Object.fromEntries(MATERIALS.map(m => [m.id, m.image]));
const materialNames = Object.fromEntries(MATERIALS.map(m => [m.id, m.name]));
if (link) link.textContent = new URL('juego.html', document.baseURI).href;

let display = {}, rawLive = {}, selected = null, raf = 0;
let scene = null, previousFrame = 0;
let currentData = '', currentInfo = '';

function stopAnimation() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  previousFrame = 0;
}
function stampName(value) { return String(value || 'JUGADOR').slice(0, 18); }
function seconds(value) {
  const t = Math.max(0, Math.floor(Number(value) || 0));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function safeNum(value, fallback = 0) {
  const n = Number(value); return Number.isFinite(n) ? n : fallback;
}

function makeCanvas(width, height, cls) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height; canvas.className = cls;
  return canvas;
}
function makePanel(cls) {
  const wrapper = document.createElement('div');
  wrapper.className = 'trasa-v23-panel ' + cls;
  const info = document.createElement('div');
  info.className = 'arcade-stage-meta trasa-v23-info';
  wrapper.append(info);
  return {wrapper, info};
}
function showWaiting() {
  stopAnimation();
  selected = null;
  title.textContent = 'ESPERANDO JUGADORES';
  if (stage.dataset.content === 'join-lobby') return;
  const box = document.createElement('div');
  box.className = 'arcade-empty-stage arcade-join-lobby';
  const caption = document.createElement('div');
  caption.className = 'arcade-join-lobby-title';
  caption.textContent = 'ESCANEA PARA JUGAR';
  const qr = document.createElement('img');
  qr.className = 'arcade-join-lobby-qr';
  qr.src = 'assets/qr-trasa-arcade.png';
  qr.alt = 'Código QR para jugar a TRASA Arcade';
  qr.width = qr.height = 256;
  const hint = document.createElement('p');
  hint.textContent = 'ABRE EL ENLACE EN TU MÓVIL Y ELIGE UN MINIJUEGO';
  box.append(caption, qr, hint);
  stage.replaceChildren(box);
  stage.dataset.content = 'join-lobby';
}
function renderMemory(state) {
  const board = scene?.board;
  if (!board) return;
  board.replaceChildren();
  (state.board || []).forEach((material, i) => {
    const cell = document.createElement('div');
    const visible = (state.open || []).includes(i) || (state.matched || []).includes(i);
    cell.className = `arcade-spectator-card ${visible ? 'is-visible' : ''}`;
    if (visible && materialImages[material]) {
      const image = document.createElement('img');
      image.src = materialImages[material]; image.alt = materialNames[material] || material;
      cell.append(image);
    } else cell.textContent = '?';
    board.append(cell);
  });
}
function createStage(player) {
  stopAnimation();
  const panel = makePanel('trasa-v23-' + player.gameId);
  const obj = {
    uid: player.uid, gameId: player.gameId, info: panel.info,
    canvas: null, board: null, state: {}, previous: {}, received: performance.now(),
    lastPaint: 0
  };
  if (player.gameId === 'memory') {
    obj.board = document.createElement('div');
    obj.board.className = 'arcade-spectator-cards';
    panel.wrapper.append(obj.board);
  } else {
    const opts = {
      run: [RUN_W, RUN_H, 'arcade-run-canvas'],
      zona: [ZONA_W, ZONA_H, 'zona-canvas'],
      snake: [SNAKE_CANVAS, SNAKE_CANVAS, 'snake-projection-canvas'],
      invaders: [INVADERS_WIDTH, INVADERS_HEIGHT, 'invaders-projection-canvas'],
      sudoku: [540, 540, 'trasa-v23-sudoku-canvas']
    };
    const [w,h,cls] = opts[player.gameId];
    obj.canvas = makeCanvas(w,h,cls);
    panel.wrapper.append(obj.canvas);
  }
  stage.replaceChildren(panel.wrapper);
  stage.dataset.content = player.gameId;
  selected = obj;
  scene = obj;
}
function renderInfo(p, s) {
  const points = `${safeNum(p.score)} PUNTOS`;
  switch (p.gameId) {
    case 'memory': return `${points} · PAREJAS ${((s.matched || []).length / 2) | 0} · TIEMPO ${safeNum(s.timeLeft)}s`;
    case 'run': return `${points} · SOBREVIVIENDO ${Math.floor(safeNum(s.time))}s`;
    case 'zona': return `${points} · NIVEL ${s.level || 1}/6 · ♻ ${s.materials || 0}/${s.need || 4} · SALUD ${s.health ?? 0} · ${seconds(s.totalTime ?? s.elapsed)}`;
    case 'snake': return `${points} · MATERIALES ♻ ${s.foods || 0}`;
    case 'invaders': return `${points} · OLEADA ${s.wave || 1}/5 · VIDAS ${s.lives ?? 3}`;
    case 'sudoku': return `${s.difficulty || 'medio'} · ${s.filled || 0}/81 CASILLAS · ERRORES ${s.mistakes || 0}/3 · ${formatSudokuTime(s.elapsed)}`;
    default: return points;
  }
}

function drawDynamic(t) {
  if (!selected || !view || view.classList.contains('hidden')) { raf = 0; return; }
  const s = selected;
  if (!s.canvas) { raf = 0; return; }
  const dt = Math.max(0, (t - s.received) / 1000);
  const draw = () => {
    try {
      switch (s.gameId) {
        case 'run': {
          const speed = safeNum(s.state.speed);
          const lag = Math.min(0.7, dt);
          const state = {
            ...s.state,
            distance: safeNum(s.state.distance) + speed * lag,
            time: safeNum(s.state.time) + lag,
            obstacles: (s.state.obstacles || []).map(o => ({...o, x: safeNum(o.x) - speed * lag}))
          };
          if (safeNum(s.state.y,223) < 223 || safeNum(s.state.vy) !== 0) {
            state.y = Math.min(223, safeNum(s.state.y,223) + safeNum(s.state.vy) * lag + 925 * lag * lag);
          }
          drawRunScene(s.canvas, state);
          break;
        }
        case 'zona': {
          const to = s.state;
          const from = s.previous?.seed === to.seed && s.previous?.level === to.level ? s.previous : to;
          const u = Math.min(1, dt / 0.45);
          const a0 = safeNum(from.a), a1 = safeNum(to.a);
          const state = {
            ...to,
            x: safeNum(from.x) + (safeNum(to.x) - safeNum(from.x)) * u,
            y: safeNum(from.y) + (safeNum(to.y) - safeNum(from.y)) * u,
            a: a0 + Math.atan2(Math.sin(a1-a0), Math.cos(a1-a0)) * u,
            enemies: (to.enemies || []).map((enemy, i) => {
              const old = from.enemies?.[i] || enemy;
              return {...enemy,
                x: safeNum(old.x) + (safeNum(enemy.x) - safeNum(old.x)) * u,
                y: safeNum(old.y) + (safeNum(enemy.y) - safeNum(old.y)) * u
              };
            })
          };
          drawZona(s.canvas, state);
          break;
        }
        case 'invaders': drawInvadersScene(s.canvas, s.state); break;
      }
    } catch (err) {
      console.error(`TRASA V23: dibujando ${s.gameId}`, err);
      stopAnimation();
    }
  };
  if (t - s.lastPaint >= (s.gameId === 'run' ? 24 : 45)) {
    s.lastPaint = t; draw();
  }
  // Los juegos de tablero no requieren un bucle constante ni repintados ajenos.
  if (selected === s && ['run','zona','invaders'].includes(s.gameId)) raf = requestAnimationFrame(drawDynamic);
  else raf = 0;
}
function setPlayer(p) {
  if (!GAME_NAMES[p.gameId]) return;
  const fresh = !selected || selected.uid !== p.uid || selected.gameId !== p.gameId;
  if (fresh) createStage(p);
  // Una única fuente de verdad para el título: ningún otro módulo lo modifica.
  const desiredTitle = `${stampName(p.name).toUpperCase()} · ${GAME_NAMES[p.gameId]}`;
  if (title.textContent !== desiredTitle) title.textContent = desiredTitle;
  const json = typeof p.state === 'string' ? p.state : '{}';
  if (json !== currentData || fresh) {
    currentData = json;
    const next = safeState(json);
    selected.previous = fresh ? next : selected.state;
    selected.state = next;
    selected.received = performance.now();
    if (selected.gameId === 'memory') renderMemory(next);
    if (selected.gameId === 'sudoku') drawSudokuScene(selected.canvas, next);
    if (selected.gameId === 'snake') drawSnakeScene(selected.canvas, next);
    if (selected.gameId === 'invaders' && !raf) drawInvadersScene(selected.canvas, next);
    if (selected.gameId === 'zona' && !raf) drawZona(selected.canvas, next);
    if (selected.gameId === 'run' && !raf) drawRunScene(selected.canvas, next);
  }
  const info = renderInfo(p, selected.state);
  if (currentInfo !== info || fresh) { selected.info.textContent = info; currentInfo = info; }
  if (['run', 'zona', 'invaders'].includes(p.gameId) && !raf) raf = requestAnimationFrame(drawDynamic);
}
function renderRoster(players) {
  if (!roster) return;
  roster.replaceChildren();
  const active = display.featuredUid || players[0]?.uid;
  if (!players.length) { roster.textContent = 'Esperando jugadores…'; return; }
  for (const p of players.slice(0,7)) {
    const row = document.createElement('div'); row.className = 'arcade-player-row';
    if (p.uid === active) row.classList.add('is-featured');
    const name = document.createElement('span');
    name.textContent = `${p.uid === active ? '▶ ' : ''}${p.name} · ${ARCADE_GAMES.find(g=>g.id===p.gameId)?.short || p.gameId}`;
    const score = document.createElement('strong'); score.textContent = `${p.score} pt`;
    row.append(name,score); roster.append(row);
  }
}
function reconcile() {
  if (!view) return;
  const open = display.mode === 'arcade';
  view.classList.toggle('hidden', !open);
  if (!open) { stopAnimation(); return; }
  const players = readLive(rawLive);
  renderRoster(players);
  const p = players.find(x=>x.uid===display.featuredUid) || players[0];
  if (!p) showWaiting();
  else setPlayer(p);
}
function ranking(game, data) {
  const node = $(RANK_IDS[game]);
  if (!node) return;
  node.replaceChildren();
  const entries = scoreRanking(data);
  if (!entries.length) { node.textContent = 'Todavía no hay récords'; return; }
  entries.forEach((p,i)=>{
    const line = document.createElement('div'); line.className = 'arcade-rank-row';
    const name = document.createElement('span');name.textContent = `${i+1}. ${stampName(p.name)}`;
    const score = document.createElement('strong'); score.textContent = String(p.score);
    line.append(name,score);node.append(line);
  });
}
async function init() {
  if (!view) return;
  if (!isFirebaseConfigured()) { console.warn('TRASA Arcade V23: Firebase no configurado'); return; }
  try {
    const f = await loadFirebase();
    await f.authMod.signInAnonymously(f.auth);
    f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('display')),snap=>{display=snap.val()||{};reconcile();},err=>console.error('TRASA display:',err));
    f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('arcade/live')),snap=>{rawLive=snap.val()||{};reconcile();},err=>console.error('TRASA live:',err));
    for (const game of Object.keys(RANK_IDS)) {
      f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('arcade/scores/'+game)), snap=>ranking(game,snap.val()), err=>{
        const target=$(RANK_IDS[game]); if(target) target.textContent='Error Firebase: '+err.message;
      });
    }
    setInterval(()=>{if(display.mode==='arcade')reconcile();},5000);
  } catch (e) { console.error('TRASA Arcade V23: error de conexión con Firebase', e); }
}
init();
