/* TRASA RUN: física y dibujo comunes para jugador y proyector.
   No requiere imágenes, librerías ni peticiones externas. */
export const RUN_W = 960;
export const RUN_H = 360;
export const RUN_GROUND = 288;
export const RUN_X = 132;
export const RUN_PLAYER_H = 65;
const RUN_GRAVITY = 1850;
const RUN_JUMP = -745;
const TYPES = ["cono", "neumatico", "barril", "contenedor"];
export const RUN_OBSTACLES = {
  cono: { width: 34, height: 43 },
  neumatico: { width: 41, height: 38 },
  barril: { width: 43, height: 56 },
  contenedor: { width: 65, height: 48 }
};

export function createRun() {
  return {
    y: RUN_GROUND - RUN_PLAYER_H,
    vy: 0,
    distance: 0,
    score: 0,
    speed: 340,
    time: 0,
    obstacles: [],
    nextObstacle: 1.65,
    lost: false
  };
}

export function jumpRun(run) {
  if (!run || run.lost || (Math.abs(run.y - (RUN_GROUND - RUN_PLAYER_H)) > .75 || run.vy !== 0)) return false;
  run.vy = RUN_JUMP;
  return true;
}

export function stepRun(run, dt, random = Math.random) {
  if (run.lost) return;
  dt = Math.max(0, Math.min(.04, Number(dt) || 0));
  run.time += dt;
  run.speed = Math.min(655, 340 + run.time * 4.6);
  run.distance += run.speed * dt;
  run.score = Math.floor(run.distance / 12);
  run.vy += RUN_GRAVITY * dt;
  run.y += run.vy * dt;
  const floor = RUN_GROUND - RUN_PLAYER_H;
  if (run.y >= floor) {
    run.y = floor;
    run.vy = 0;
  }
  run.nextObstacle -= dt;
  if (run.nextObstacle <= 0) {
    const type = TYPES[Math.floor(random() * TYPES.length)];
    run.obstacles.push({ type, x: RUN_W + 12 });
    // La separación disminuye progresivamente, con margen para saltar.
    run.nextObstacle = Math.max(.98, 1.55 - run.time * .004) + random() * .48;
  }
  for (const o of run.obstacles) o.x -= run.speed * dt;
  run.obstacles = run.obstacles.filter(o => o.x > -110);
  const px = RUN_X + 10, py = run.y + 9, pw = 26, ph = RUN_PLAYER_H - 12;
  for (const o of run.obstacles) {
    const d = RUN_OBSTACLES[o.type];
    if (!d) continue;
    const ox = o.x + 5, oy = RUN_GROUND - d.height + 5;
    if (px < ox + d.width - 10 && px + pw > ox && py < RUN_GROUND - 5 && py + ph > oy) {
      run.lost = true;
      break;
    }
  }
}

export function packRunState(run) {
  return {
    y: Math.round(run.y),
    vy: Math.round(run.vy),
    distance: Math.round(run.distance),
    speed: Math.round(run.speed),
    time: Math.round(run.time),
    obstacles: run.obstacles.map(o => ({ x: Math.round(o.x), type: o.type }))
  };
}

function roundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath(); ctx.fill();
}

function drawWorker(ctx, x, y, t = 0) {
  const onGround = Math.abs(y - (RUN_GROUND - RUN_PLAYER_H)) < 1;
  const stride = onGround ? Math.sin(t * 16) * 9 : 0;
  // Sombra sobre el asfalto
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath(); ctx.ellipse(x + 23, RUN_GROUND + 1, onGround ? 26 : 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Botas y piernas en carrera
  ctx.strokeStyle = "#151c1c";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x + 18, y + 42); ctx.lineTo(x + 15 - stride, y + 61); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 32, y + 42); ctx.lineTo(x + 35 + stride, y + 61); ctx.stroke();
  ctx.strokeStyle = "#63796c";
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x + 11 - stride, y + 61); ctx.lineTo(x + 23 - stride, y + 61); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 31 + stride, y + 61); ctx.lineTo(x + 43 + stride, y + 61); ctx.stroke();
  // Uniforme TRASA: chaleco reflectante
  roundRect(ctx, x + 11, y + 20, 29, 27, 6, "#647c58");
  ctx.fillStyle = "#d8e7a5";
  ctx.fillRect(x + 13, y + 26, 25, 5);
  ctx.fillStyle = "#dce8d6";
  ctx.font = "bold 8px Arial";
  ctx.fillText("TRASA", x + 13, y + 41);
  // Brazos
  ctx.strokeStyle = "#c9ab86"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(x + 13, y + 26); ctx.lineTo(x + 4 + stride*.6, y + 44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 39, y + 26); ctx.lineTo(x + 47 - stride*.6, y + 40); ctx.stroke();
  // Cabeza y casco de obra
  roundRect(ctx, x + 18, y + 5, 18, 19, 7, "#c8a581");
  roundRect(ctx, x + 16, y + 1, 22, 9, 4, "#b9cf8e");
  ctx.fillStyle = "#c7da96"; ctx.fillRect(x + 12, y + 9, 30, 4);
  ctx.fillStyle = "#263028"; ctx.fillRect(x + 31, y + 14, 2.5, 3);
}

function obstacle(ctx, o) {
  const d = RUN_OBSTACLES[o.type];
  if (!d) return;
  const x = o.x, y = RUN_GROUND - d.height;
  if (o.type === "cono") {
    ctx.fillStyle = "#e89c47";
    ctx.beginPath(); ctx.moveTo(x + d.width/2, y); ctx.lineTo(x + d.width-5, RUN_GROUND - 7); ctx.lineTo(x + 5, RUN_GROUND - 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#fff0ce"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 11, y + 27); ctx.lineTo(x + 24, y + 27); ctx.stroke();
    roundRect(ctx, x, RUN_GROUND - 8, d.width, 8, 2, "#b6a48d");
  } else if (o.type === "neumatico") {
    ctx.fillStyle = "#161c1c"; ctx.beginPath(); ctx.ellipse(x+20,y+19,21,18,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#8a9b91"; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x+20,y+19,10,9,0,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle = "#353e39"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x+20,y+19,17,15,0,0,Math.PI*2); ctx.stroke();
  } else if (o.type === "barril") {
    roundRect(ctx, x, y, d.width, d.height, 6, "#8c9c91");
    ctx.fillStyle = "#c8d5c2"; ctx.fillRect(x+2,y+8,d.width-4,6); ctx.fillRect(x+2,y+40,d.width-4,6);
    ctx.fillStyle = "#4a604e"; ctx.font = "bold 20px Arial"; ctx.fillText("♻", x+9, y+34);
  } else {
    roundRect(ctx,x,y,d.width,d.height,5,"#5d785b");
    ctx.fillStyle = "#a8bd9e"; ctx.fillRect(x+3,y+9,d.width-6,6);
    ctx.fillStyle = "#243929"; ctx.font = "bold 11px Arial"; ctx.fillText("TRASA",x+10,y+31);
  }
}

/** Dibuja un estado de juego dentro del canvas a 960×360, sin modificarlo. */
export function drawRunScene(canvas, source = {}, options = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, RUN_W, RUN_H);
  const sky = ctx.createLinearGradient(0,0,0,RUN_GROUND);
  sky.addColorStop(0,"#243328"); sky.addColorStop(1,"#354b3b");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, RUN_W, RUN_GROUND);
  ctx.fillStyle = "rgba(205,230,184,.10)"; ctx.beginPath(); ctx.arc(795,70,43,0,Math.PI*2);ctx.fill();
  // Fábrica de fondo (parallax, sin assets)
  const drift = Number(source.distance || 0) * .11;
  for(let i=-1;i<8;i++){
    const x=(i*167 - drift%167);
    ctx.fillStyle = i%2 ? "#233b2d":"#2a4132";
    ctx.fillRect(x,RUN_GROUND-142,112,144);
    ctx.fillStyle = "#b5cba5";
    for(let w=0;w<3;w++) ctx.fillRect(x+15+w*30,RUN_GROUND-123,13,30);
    ctx.fillStyle = "#182f22"; ctx.fillRect(x+85,RUN_GROUND-190,23,48);
  }
  ctx.fillStyle = "#111a15"; ctx.fillRect(0,RUN_GROUND,RUN_W,RUN_H-RUN_GROUND);
  ctx.fillStyle = "#738c70"; ctx.fillRect(0,RUN_GROUND,RUN_W,5);
  ctx.fillStyle = "#5b6e59";
  const offset = (Number(source.distance || 0)*1.15)%104;
  for(let x=-104+offset;x<RUN_W;x+=104) ctx.fillRect(x,RUN_GROUND+39,58,5);
  for (const o of source.obstacles || []) obstacle(ctx,o);
  drawWorker(ctx,RUN_X,Number(source.y ?? (RUN_GROUND-RUN_PLAYER_H)),Number(source.time || 0));
  roundRect(ctx,17,16,168,34,9,"rgba(8,19,11,.66)");
  ctx.fillStyle="#d5e5cd"; ctx.font="bold 19px Arial"; ctx.fillText("TRASA RUN",34,40);
  if (options.gameOver){
    ctx.fillStyle="rgba(4,8,5,.68)";ctx.fillRect(0,0,RUN_W,RUN_H);
    ctx.fillStyle="#e7f1e2";ctx.textAlign="center";ctx.font="bold 48px Arial";
    ctx.fillText("FIN DE PARTIDA",RUN_W/2,169);
    ctx.font="24px Arial";ctx.fillText(`PUNTOS: ${options.score ?? 0}`,RUN_W/2,208);
    ctx.textAlign="left";
  }
}
