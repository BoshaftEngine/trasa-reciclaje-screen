/* TRASA RUN: física y dibujo comunes para jugador y proyector.
   PERSONALIZACIÓN: reemplaza las imágenes de assets/trasa-run/ por tus PNG.
   Si alguna falta, se dibuja el elemento original como respaldo.
   No cambia la física ni las dimensiones de las colisiones. */

// Nombres de archivo que puedes sustituir en GitHub sin tocar este JS.
export const RUN_IMAGE_PATHS = {
  fondo: "assets/trasa-run/fondo.png",
  trabajadorCorre1: "assets/trasa-run/trabajador-corre-1.png",
  trabajadorCorre2: "assets/trasa-run/trabajador-corre-2.png",
  trabajadorCorre3: "assets/trasa-run/trabajador-corre-3.png",
  trabajadorCorre4: "assets/trasa-run/trabajador-corre-4.png",
  trabajadorCorre5: "assets/trasa-run/trabajador-corre-5.png",
  trabajadorCorre6: "assets/trasa-run/trabajador-corre-6.png",
  trabajadorCorre7: "assets/trasa-run/trabajador-corre-7.png",
  trabajadorCorre8: "assets/trasa-run/trabajador-corre-8.png",
  trabajadorSalta: "assets/trasa-run/trabajador-salta.png",
  trabajadorAgachado: "assets/trasa-run/trabajador-agachado.png",
  cono: "assets/trasa-run/cono.png",
  neumatico: "assets/trasa-run/neumatico.png",
  barril: "assets/trasa-run/barril.png",
  contenedor: "assets/trasa-run/contenedor.png",
  bolsaBasura: "assets/trasa-run/bolsa-basura.png"
};

const loadedRunImages = {};
if (typeof Image !== "undefined") {
  for (const [key, url] of Object.entries(RUN_IMAGE_PATHS)) {
    const img = new Image();
    img.onload = () => { loadedRunImages[key] = img; };
    img.onerror = () => {}; // Si falta una imagen, se mantiene el dibujo original.
    img.src = url + "?v=5"; // Incrementa v= si cambias los PNG y ves sprites antiguos.
  }
}

// Ajusta cada PNG a un rectángulo sin deformarlo, manteniendo el pixel art.
// align=bottom sirve para que las botas y los obstáculos apoyen en el suelo.
function drawSprite(ctx, key, x, y, width, height, align = "bottom") {
  const img = loadedRunImages[key];
  if (!img || !img.naturalWidth || !img.naturalHeight) return false;

  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const dx = x + (width - w) / 2;
  const dy = y + (align === "center" ? (height - h) / 2 : height - h);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, dx, dy, w, h);
  ctx.restore();
  return true;
}

// Los 8 frames están soportados aunque todavía no hayas subido todos.
// Si solo existen dos, el juego alterna esos dos sin parpadeos.
const RUN_FRAMES = [
  "trabajadorCorre1", "trabajadorCorre2", "trabajadorCorre3", "trabajadorCorre4",
  "trabajadorCorre5", "trabajadorCorre6", "trabajadorCorre7", "trabajadorCorre8"
];

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  ctx.drawImage(img, x + (w-iw)/2, y + (h-ih)/2, iw, ih);
}

export const RUN_W = 960;
export const RUN_H = 360;
export const RUN_GROUND = 288;
export const RUN_X = 132;
export const RUN_PLAYER_H = 65;
const RUN_GRAVITY = 1850;
// Salto más bajo: ~70 px frente a los ~150 px anteriores.
// Sigue permitiendo superar el barril (56 px), pero no la bolsa voladora.
const RUN_JUMP = -510;
const GROUND_TYPES = ["cono", "neumatico", "barril", "contenedor"];
const AIR_TYPE = "bolsaBasura";
const RUN_FLOOR_Y = RUN_GROUND - RUN_PLAYER_H;
const RUN_CROUCH_H = 34;
// Las bolsas pasan lo bastante bajas para rozar a un corredor erguido,
// pero lo bastante altas para poder esquivarlas agachándose.
// Importante: NO bajar la bolsa a -74: su parte inferior chocaría
// incluso con el trabajador agachado. -84 permite esquivar agachándose.
const BAG_TOP = RUN_GROUND - 84;
export const RUN_OBSTACLES = {
  cono: { width: 34, height: 43 },
  neumatico: { width: 41, height: 38 },
  barril: { width: 43, height: 56 },
  contenedor: { width: 65, height: 48 },
  bolsaBasura: { width: 58, height: 52, air: true }
};

function onGround(run) {
  return Math.abs(run.y - RUN_FLOOR_Y) <= .75 && run.vy === 0;
}

function obstacleTop(o, time = 0) {
  const dims = RUN_OBSTACLES[o.type];
  if (!dims?.air) return RUN_GROUND - dims.height;
  // Movimiento suave flotante, idéntico en el jugador y en el proyector.
  return BAG_TOP + Math.sin(Number(time || 0) * 4 + Number(o.phase || 0)) * 4;
}

export function createRun() {
  return {
    y: RUN_FLOOR_Y,
    vy: 0,
    ducking: false,
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
  if (!run || run.lost || run.ducking || !onGround(run)) return false;
  run.vy = RUN_JUMP;
  return true;
}

/** Pulsación sostenida: S, flecha abajo o botón de móvil. */
export function duckRun(run, pressed) {
  if (!run || run.lost) return;
  run.ducking = Boolean(pressed);
}

export function stepRun(run, dt, random = Math.random) {
  if (run.lost) return;
  dt = Math.max(0, Math.min(.04, Number(dt) || 0));
  run.time += dt;
  // Más rápido que la versión anterior: 340 inicial, +16 cada segundo,
  // alcanza 660 a los 20 s y el máximo de 900 sobre los 35 s.
  run.speed = Math.min(900, 340 + run.time * 16);
  run.distance += run.speed * dt;
  run.score = Math.floor(run.distance / 12);
  run.vy += RUN_GRAVITY * dt;
  run.y += run.vy * dt;
  if (run.y >= RUN_FLOOR_Y) {
    run.y = RUN_FLOOR_Y;
    run.vy = 0;
  }
  run.nextObstacle -= dt;
  if (run.nextObstacle <= 0) {
    // Bolsas voladoras a partir de unos segundos de partida.
    // La elección es aleatoria; nunca hay un obstáculo de suelo y uno
    // aéreo superpuestos en la misma aparición.
    const airborne = run.time >= 4 && random() < .34;
    const type = airborne ? AIR_TYPE : GROUND_TYPES[Math.floor(random() * GROUND_TYPES.length)];
    run.obstacles.push({ type, x: RUN_W + 12, ...(airborne ? { phase: random() * 6.28 } : {}) });
    // Aparecen algo más a menudo con el tiempo, dejando margen para reaccionar.
    run.nextObstacle = Math.max(.94, 1.47 - run.time * .010) + random() * .42;
  }
  for (const o of run.obstacles) o.x -= run.speed * dt;
  run.obstacles = run.obstacles.filter(o => o.x > -110);
  const crouched = run.ducking && onGround(run);
  const px = RUN_X + 10;
  const py = crouched ? RUN_GROUND - RUN_CROUCH_H + 5 : run.y + 9;
  const pw = crouched ? 36 : 26;
  const ph = crouched ? RUN_CROUCH_H - 9 : RUN_PLAYER_H - 12;
  for (const o of run.obstacles) {
    const d = RUN_OBSTACLES[o.type];
    if (!d) continue;
    const ox = o.x + 5;
    const oy = obstacleTop(o, run.time) + 4;
    const ow = d.width - 10, oh = d.height - 8;
    if (px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy) {
      run.lost = true;
      break;
    }
  }
}

export function packRunState(run) {
  return {
    y: Math.round(run.y),
    vy: Math.round(run.vy),
    ducking: Boolean(run.ducking),
    distance: Math.round(run.distance),
    speed: Math.round(run.speed),
    time: Math.round(run.time),
    obstacles: run.obstacles.map(o => ({
      x: Math.round(o.x), type: o.type,
      ...(o.type === AIR_TYPE ? { phase: Number(o.phase || 0) } : {})
    }))
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

function drawWorker(ctx, x, y, t = 0, ducking = false) {
  const onGround = Math.abs(y - (RUN_GROUND - RUN_PLAYER_H)) < 1;
  const crouched = ducking && onGround;
  const stride = onGround ? Math.sin(t * 16) * 9 : 0;
  // Sombra sobre el asfalto
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath(); ctx.ellipse(x + 23, RUN_GROUND + 1, onGround ? 26 : 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (crouched) {
    const crouchY = RUN_GROUND - RUN_CROUCH_H;
    // El dibujo mantiene la proporción original y toca el suelo.
    if (drawSprite(ctx, "trabajadorAgachado", x - 12, RUN_GROUND - 43, 82, 43)) return;
    // Respaldo si el usuario todavía no ha subido su PNG agachado.
    roundRect(ctx, x+10, crouchY+11, 44, 20, 6, "#647c58");
    ctx.fillStyle="#d8e7a5"; ctx.fillRect(x+12,crouchY+18,40,4);
    roundRect(ctx,x+19,crouchY,21,17,7,"#c8a581");
    roundRect(ctx,x+17,crouchY,26,8,3,"#b9cf8e");
    ctx.fillStyle="#dce8d6";ctx.font="bold 8px Arial";ctx.fillText("TRASA",x+15,crouchY+29);
    return;
  }
  // Hasta ocho posturas por ciclo, a unos 15 fotogramas por segundo.
  // Solo usamos los PNG que realmente se hayan podido cargar.
  const availableFrames = RUN_FRAMES.filter(key => Boolean(loadedRunImages[key]));
  const index = availableFrames.length ? Math.floor(t * 15) % availableFrames.length : 0;
  const spriteKey = onGround ? availableFrames[index] : "trabajadorSalta";

  // El trabajador aportado tiene relación de aspecto cercana a 2:1.
  // La caja de dibujo es ANCHA, pero respeta siempre su proporción real.
  // No alteramos el tamaño de la hitbox física al cambiar la imagen.
  if (spriteKey && drawSprite(ctx, spriteKey, x - 18, y - 6, 100, 72)) return;
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

function obstacle(ctx, o, time = 0) {
  const d = RUN_OBSTACLES[o.type];
  if (!d) return;
  const x = o.x, y = obstacleTop(o, time);
  if (drawSprite(ctx, o.type, x, y, d.width, d.height)) return;
  if (o.type === AIR_TYPE) {
    // Bolsa de basura movida por el viento; se esquiva agachándose.
    ctx.fillStyle = "rgba(12,19,16,.22)";
    ctx.beginPath();ctx.ellipse(x+d.width/2,RUN_GROUND+1,24,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#252c2a";
    ctx.beginPath();ctx.moveTo(x+24,y+9);ctx.quadraticCurveTo(x+10,y+14,x+5,y+34);
    ctx.quadraticCurveTo(x+4,y+52,x+30,y+50);ctx.quadraticCurveTo(x+55,y+49,x+53,y+32);
    ctx.quadraticCurveTo(x+47,y+14,x+34,y+9);ctx.closePath();ctx.fill();
    roundRect(ctx,x+23,y+2,14,12,5,"#47584e");
    ctx.strokeStyle="#9eaca0";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x-10,y+23);ctx.lineTo(x+2,y+18);ctx.moveTo(x+56,y+15);ctx.lineTo(x+69,y+11);ctx.stroke();
  } else if (o.type === "cono") {
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
  // Fondo: tu imagen personalizada o la fábrica dibujada original.
  const background = loadedRunImages.fondo;
  if (background) drawCover(ctx, background, 0, 0, RUN_W, RUN_GROUND);
  const drift = Number(source.distance || 0) * .11;
  if (!background) for(let i=-1;i<8;i++){
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
  for (const o of source.obstacles || []) obstacle(ctx,o,Number(source.time || 0));
  drawWorker(ctx,RUN_X,Number(source.y ?? RUN_FLOOR_Y),Number(source.time || 0),Boolean(source.ducking));
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
