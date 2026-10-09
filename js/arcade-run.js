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
    img.src = url + "?v=7"; // Incrementa v= si cambias los PNG y ves sprites antiguos.
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
// Bolsa baja: solo se evita manteniéndose agachado.
// El salto no llega a colocar la cabeza por encima de la bolsa.
const BAG_TOP = RUN_GROUND - 84;
export const RUN_OBSTACLES = {
  cono: { width: 34, height: 43 },
  neumatico: { width: 41, height: 38 },
  barril: { width: 43, height: 56 },
  contenedor: { width: 65, height: 48 },
  bolsaBasura: { width: 58, height: 44, air: true }
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
    // NUEVA MECÁNICA: ráfagas con aviso y aceleración temporal.
    // La estructura viaja a Firebase para que el público vea el mismo efecto.
    wind: { phase: "idle", remaining: 11.0 },
    // Segundo obstáculo de una combinación "aterriza y vuelve a saltar".
    pendingFollowUp: null,
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

// Utiliza la misma posición inicial en los dos navegadores.
function addRunObstacle(run, type, random, offset = 0) {
  const airborne = type === AIR_TYPE;
  run.obstacles.push({
    type,
    x: RUN_W + 12 + offset,
    ...(airborne ? { phase: random() * 6.28 } : {})
  });
}

function chooseGroundObstacle(random) {
  return GROUND_TYPES[Math.min(GROUND_TYPES.length - 1,
    Math.floor(random() * GROUND_TYPES.length))];
}

// Intervalos variables para evitar el ritmo mecánico anterior.
// Los descansos están expresados en segundos para adaptarse a la velocidad.
function randomPause(run, random) {
  const minimum = Math.max(1.05, 1.52 - run.time * .009);
  return minimum + random() * 1.15;
}

// Las ráfagas empiezan después de unos 11 segundos y se repiten
// cada 11–18 s. El aviso da tiempo a prepararse: no hay cambios secretos.
const WIND_WARNING_SECONDS = 1.5;
const WIND_GUST_SECONDS = 2.8;
const WIND_SPEED_FACTOR = 1.26;

function updateWind(run, dt, random) {
  if (!run.wind || typeof run.wind !== "object") {
    run.wind = { phase: "idle", remaining: 11 };
  }
  run.wind.remaining -= dt;
  if (run.wind.remaining > 0) return;
  switch (run.wind.phase) {
    case "idle":
      run.wind.phase = "warning";
      run.wind.remaining = WIND_WARNING_SECONDS;
      break;
    case "warning":
      run.wind.phase = "gust";
      run.wind.remaining = WIND_GUST_SECONDS;
      break;
    default:
      run.wind.phase = "idle";
      run.wind.remaining = 11 + random() * 7;
  }
}

export function stepRun(run, dt, random = Math.random) {
  if (run.lost) return;
  dt = Math.max(0, Math.min(.04, Number(dt) || 0));
  run.time += dt;
  // Aceleración progresiva de V6 + ráfagas de viento.
  // Durante la ráfaga, la velocidad aumenta un 26 % durante 2,8 segundos.
  // Se avisa 1,5 segundos antes para que sea un reto justo.
  updateWind(run, dt, random);
  const baseSpeed = Math.min(900, 340 + run.time * 16);
  run.speed = Math.round(baseSpeed * (run.wind.phase === "gust" ? WIND_SPEED_FACTOR : 1));
  run.distance += run.speed * dt;
  run.score = Math.floor(run.distance / 12);
  run.vy += RUN_GRAVITY * dt;
  run.y += run.vy * dt;
  if (run.y >= RUN_FLOOR_Y) {
    run.y = RUN_FLOOR_Y;
    run.vy = 0;
  }
  // Una segunda aparición programada mantiene la separación de tiempo
  // necesaria para aterrizar después del primer salto y volver a saltar.
  if (run.pendingFollowUp) {
    run.pendingFollowUp.remaining -= dt;
    if (run.pendingFollowUp.remaining <= 0) {
      addRunObstacle(run, run.pendingFollowUp.type, random);
      run.pendingFollowUp = null;
    }
  }

  run.nextObstacle -= dt;
  if (run.nextObstacle <= 0) {
    const pattern = random();

    if (run.time >= 12 && pattern < .22) {
      // PATRÓN 1: dos obstáculos bajos juntos. Un salto bien medido
      // supera ambos; se dejan 68 px entre sus posiciones de inicio.
      // Solo conos/neumáticos: no se generan barriles altos en este patrón.
      addRunObstacle(run, "cono", random);
      addRunObstacle(run, "neumatico", random, 68);
      run.nextObstacle = 1.4 + random() * .9;

    } else if (run.time >= 9 && pattern < .48) {
      // PATRÓN 2: dos obstáculos de suelo separados por 0.76–0.90 s.
      // El salto dura ~0.55 s. Por tanto, al caer hay tiempo
      // para pulsar de nuevo. No combinamos aquí bolsas voladoras.
      addRunObstacle(run, chooseGroundObstacle(random), random);
      const followDelay = .76 + random() * .14;
      run.pendingFollowUp = {
        remaining: followDelay,
        type: chooseGroundObstacle(random)
      };
      // Descanso tras el segundo obstáculo antes del siguiente patrón.
      run.nextObstacle = followDelay + 1.3 + random() * .8;

    } else {
      // PATRÓN NORMAL: obstáculo único, bolsa (desde 4 s) o suelo.
      // Los huecos fluctúan de forma notable para que no se memoricen.
      const airborne = run.time >= 4 && random() < .34;
      addRunObstacle(run, airborne ? AIR_TYPE : chooseGroundObstacle(random), random);
      run.nextObstacle = randomPause(run, random);
    }
  }
  for (const o of run.obstacles) o.x -= run.speed * dt;
  run.obstacles = run.obstacles.filter(o => o.x > -110);
  const crouched = run.ducking && onGround(run);
  const px = RUN_X + 10;
  // La hitbox de pie incluye la cabeza: las bolsas no se pueden saltar.
  const py = crouched ? RUN_GROUND - RUN_CROUCH_H + 5 : run.y + 2;
  const pw = crouched ? 36 : 26;
  const ph = crouched ? RUN_CROUCH_H - 9 : RUN_PLAYER_H - 5;
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
    time: Number(run.time.toFixed(2)),
    wind: { phase: run.wind?.phase || "idle", remaining: Math.max(0, Number((run.wind?.remaining || 0).toFixed(2))) },
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
    // Vuelve al aspecto compacto de V5: agacharse encoge el sprite.
    // La colisión también se mantiene baja para evitar las bolsas.
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
  // Viento visible tanto para el jugador como para los espectadores.
  const windPhase = source.wind?.phase || "idle";
  if (windPhase === "gust") {
    const t = Number(source.time || 0);
    ctx.save();
    ctx.strokeStyle = "rgba(210,234,195,.40)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const x = ((i * 107 - t * 360) % 1120 + 1120) % 1120 - 85;
      const y = 70 + (i * 37) % 193;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 34 + (i % 3) * 15, y - 7);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const o of source.obstacles || []) obstacle(ctx,o,Number(source.time || 0));
  drawWorker(ctx,RUN_X,Number(source.y ?? RUN_FLOOR_Y),Number(source.time || 0),Boolean(source.ducking));
  if (windPhase === "warning" || windPhase === "gust") {
    roundRect(ctx, 617, 15, 327, 37, 8,
      windPhase === "warning" ? "rgba(139,93,31,.94)" : "rgba(72,111,53,.94)");
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 18px Arial";
    ctx.fillText(windPhase === "warning"
      ? `VIENTO EN ${Math.max(1, Math.ceil(Number(source.wind?.remaining || 0)))} s`
      : "RÁFAGA DE VIENTO  +26 %", 780, 40);
    ctx.textAlign = "left";
  }
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
