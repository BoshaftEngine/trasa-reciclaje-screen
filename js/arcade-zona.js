
/* TRASA ZONA CONTAMINADA — prototipo FPS retro.
   Sustituye los PNG de assets/zona-contaminada conservando sus nombres. */
export const ZONA_W = 640, ZONA_H = 360, ZONA_SECONDS = 210;
export const ZONA_ASSETS = {
  hormigon:'assets/zona-contaminada/pared-hormigon.png',
  metal:'assets/zona-contaminada/pared-metal.png',
  puerta:'assets/zona-contaminada/puerta.png',
  robot1:'assets/zona-contaminada/robot-1.png',
  robot2:'assets/zona-contaminada/robot-2.png',
  robotDead:'assets/zona-contaminada/robot-destruido.png',
  material:'assets/zona-contaminada/material.png',
  especial:'assets/zona-contaminada/material-especial.png',
  tarjeta:'assets/zona-contaminada/tarjeta.png',
  bateria:'assets/zona-contaminada/bateria.png',
  botiquin:'assets/zona-contaminada/botiquin.png',
  salida:'assets/zona-contaminada/salida.png',
  arma:'assets/zona-contaminada/arma.png',
  armaDisparo:'assets/zona-contaminada/arma-disparo.png',
  barril:'assets/zona-contaminada/barril.png',
  barrilRoto:'assets/zona-contaminada/barril-roto.png',
  shotPlayer:'assets/zona-contaminada/proyectil-jugador.png',
  shotEnemy:'assets/zona-contaminada/proyectil-robot.png'
};
const pics={};
if(typeof Image!=='undefined') for(const [k,u] of Object.entries(ZONA_ASSETS)){
  const img=new Image(); img.onload=()=>{pics[k]=img;}; img.src=u+'?v=2';
}
const CELL=17, FOV=Math.PI/3, MAX_RAY=20;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const key=(x,y)=>`${x},${y}`;
const rnd32=seed=>()=>{seed|=0; seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t=(t+Math.imul(t^t>>>7,61|t))^t;return ((t^t>>>14)>>>0)/4294967296;};
const worlds=new Map();
const findOpen=(world,x,y,doorOpen=false)=>{const cx=Math.floor(x),cy=Math.floor(y);if(cx<0||cy<0||cx>=CELL||cy>=CELL)return false;const v=world.map[cy][cx];return v!==1&&(v!==2||doorOpen);};
const movable=(world,x,y,open)=>{const r=.18;return findOpen(world,x-r,y-r,open)&&findOpen(world,x+r,y-r,open)&&findOpen(world,x-r,y+r,open)&&findOpen(world,x+r,y+r,open);};
const shuffle=(list,r)=>{for(let i=list.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
function message(g,s,t=2){g.notice=s;g.noticeTime=t;}
function consumed(g,i){return ((g.itemsMask>>>i)&1)!==0;}
function barrelGone(g,i){return ((g.barrelsMask>>>i)&1)!==0;}
function hurt(g,amount=1){if(g.damageCooldown>0||g.countdown>0)return;g.health-=amount;g.damageCooldown=1.0;g.flash=.35;message(g,'¡CUIDADO! DAÑO RECIBIDO');if(g.health<=0){g.lost=true;message(g,'SIN SALUD. FIN DE PARTIDA',5);}}
function lineOfSight(world,x0,y0,x1,y1,doorOpen){const d=Math.hypot(x1-x0,y1-y0);const steps=Math.ceil(d*9);for(let i=1;i<steps;i++){const t=i/steps;if(!findOpen(world,x0+(x1-x0)*t,y0+(y1-y0)*t,doorOpen))return false;}return true;}

export function makeZonaWorld(seed=2768){
  seed=Number(seed)||2768; if(worlds.has(seed)) return worlds.get(seed);
  const r=rnd32(seed), map=Array.from({length:CELL},()=>Array(CELL).fill(1));
  const dirs=[[2,0],[-2,0],[0,2],[0,-2]]; const stk=[[1,1]]; map[1][1]=0;
  while(stk.length){ const [x,y]=stk[stk.length-1]; const options=shuffle([...dirs],r).filter(([dx,dy])=>x+dx>0&&x+dx<CELL-1&&y+dy>0&&y+dy<CELL-1&&map[y+dy][x+dx]);
    if(!options.length){stk.pop();continue;} const [dx,dy]=options[0]; map[y+dy/2][x+dx/2]=0; map[y+dy][x+dx]=0; stk.push([x+dx,y+dy]); }
  for(let i=0;i<12;i++){let x=2+Math.floor(r()*13),y=2+Math.floor(r()*13); if(map[y][x]===1){const h=map[y][x-1]===0&&map[y][x+1]===0; const v=map[y-1][x]===0&&map[y+1][x]===0; if(h||v) map[y][x]=0;}}
  const start={x:1.5,y:1.5};
  const distance=Array.from({length:CELL},()=>Array(CELL).fill(-1)); const q=[[1,1]]; distance[1][1]=0;
  for(let i=0;i<q.length;i++){const [x,y]=q[i]; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy; if(nx>0&&ny>0&&nx<CELL-1&&ny<CELL-1&&map[ny][nx]!==1&&distance[ny][nx]<0){distance[ny][nx]=distance[y][x]+1; q.push([nx,ny]);}}}
  const avail=q.slice(1).sort((a,b)=>distance[b[1]][b[0]]-distance[a[1]][a[0]]); const end=avail[0], exit={x:end[0]+.5,y:end[1]+.5};
  const near=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[end[0]+dx,end[1]+dy]).find(([x,y])=>distance[y]?.[x]===distance[end[1]][end[0]]-1);
  if(near) map[near[1]][near[0]]=2;
  const blocked=new Set([key(1,1),key(end[0],end[1]),near?key(...near):'']);
  const place=(type,candidates)=>{const choices=shuffle(candidates.filter(([x,y])=>!blocked.has(key(x,y))),r); const loc=choices[0]; if(!loc) throw Error('Mapa sin espacio para '+type); blocked.add(key(...loc)); return {type,x:loc[0]+.5,y:loc[1]+.5};};
  const mid=q.filter(([x,y])=>distance[y][x]>5&&distance[y][x]<distance[end[1]][end[0]]*.79);
  const farther=q.filter(([x,y])=>distance[y][x]>8);
  const keycard=place('tarjeta',mid.length?mid:q);
  const items=[...Array.from({length:5},()=>place('material',farther.length?farther:q)), place('especial',farther.length?farther:q), keycard, place('bateria',q), place('botiquin',q)];
  const enemies=Array.from({length:3},()=>{const p=place('robot',farther.length?farther:q); return {...p,hp:2};});
  const barrels=Array.from({length:5},()=>place('barril', farther.length?farther:q));
  const result={seed,map,start,exit,items,enemies,barrels,exitDistance:distance[end[1]][end[0]]};
  if(worlds.size>=12) worlds.delete(worlds.keys().next().value); worlds.set(seed,result); return result;
}

export function createZona(seed=Math.floor(Math.random()*2000000000)+1){
  const world=makeZonaWorld(seed); const initialDirection=world.map[1][2]===0?0:Math.PI/2;
  return {
    seed,x:world.start.x,y:world.start.y,a:initialDirection,
    health:3,ammo:9,time:0,remaining:ZONA_SECONDS,score:0,materials:0,hasKey:false,
    itemsMask:0,barrelsMask:0,
    enemies:world.enemies.map((o,i)=>({x:o.x,y:o.y,hp:o.hp,cooldown:0.7+i*0.25,moving:false,deadTime:0})),
    playerShots:[], enemyShots:[],
    damageCooldown:0, shotCooldown:0, weaponFlash:0, flash:0,
    notice:'RECUPERA 4 MATERIALES Y LA TARJETA',noticeTime:4,
    won:false,lost:false,showMap:false,countdown:3.2
  };
}

function spawnPlayerShot(g){ g.playerShots.push({x:g.x+Math.cos(g.a)*.28,y:g.y+Math.sin(g.a)*.28,dx:Math.cos(g.a),dy:Math.sin(g.a),ttl:0.95}); }
function spawnEnemyShot(g,e){ const a=Math.atan2(g.y-e.y,g.x-e.x); g.enemyShots.push({x:e.x+Math.cos(a)*.28,y:e.y+Math.sin(a)*.28,dx:Math.cos(a),dy:Math.sin(a),ttl:1.6}); }

export function shootZona(g){
  if(!g||g.lost||g.won||g.countdown>0||g.shotCooldown>0) return false;
  if(g.ammo<=0){message(g,'SIN BATERÍA · BUSCA RECARGAS',1.3); return false;}
  g.ammo--; g.shotCooldown=.26; g.weaponFlash=.11; g.flash=.09; spawnPlayerShot(g); return true;
}

export function interactZona(g){
  if(!g||g.lost||g.won||g.countdown>0) return;
  const world=makeZonaWorld(g.seed);
  if(dist(g,world.exit)<1.5){
    if(!g.hasKey){message(g,'SALIDA BLOQUEADA · BUSCA LA TARJETA');return;}
    if(g.materials<4){message(g,`FALTAN ${4-g.materials} MATERIALES PARA SALIR`);return;}
    g.won=true; g.score+=500+Math.ceil(g.remaining)*10+g.health*100; message(g,'¡MISIÓN COMPLETADA! SALIDA SEGURA',5); return;
  }
  message(g,'ACÉRCATE A LA SALIDA PARA INTERACTUAR',1.4);
}

function advanceShots(g, world, dt){
  const stepShot=(arr, owner)=>{
    const speed = owner==='player'?8.8:5.3;
    for(let i=arr.length-1;i>=0;i--){
      const s=arr[i]; s.ttl-=dt; if(s.ttl<=0){arr.splice(i,1); continue;}
      let dead=false; const step=speed*dt, pieces=Math.max(1, Math.ceil(step/.08));
      for(let p=0;p<pieces&&!dead;p++){
        s.x += s.dx*(step/pieces); s.y += s.dy*(step/pieces);
        if(!findOpen(world,s.x,s.y,g.hasKey)){ dead=true; break; }
        if(owner==='player'){
          for(let ei=0; ei<g.enemies.length && !dead; ei++){
            const e=g.enemies[ei]; if(e.hp<=0) continue;
            if(Math.hypot(s.x-e.x,s.y-e.y)<.28){ e.hp--; dead=true; e.deadTime=0; if(e.hp<=0){g.score+=75; message(g,'ROBOT DESACTIVADO +75');} else message(g,'IMPACTO · 1 GOLPE MÁS',1.1); }
          }
          const barrels=world.barrels||[];
          for(let bi=0; bi<barrels.length && !dead; bi++){
            const b=barrels[bi]; if(barrelGone(g,bi)) continue;
            if(Math.hypot(s.x-b.x,s.y-b.y)<.26){ g.barrelsMask|=(1<<bi); g.score+=25; dead=true; message(g,'BARRIL DESTRUIDO +25',1.1); }
          }
        } else {
          if(Math.hypot(s.x-g.x,s.y-g.y)<.20){ hurt(g,1); dead=true; }
        }
      }
      if(dead) arr.splice(i,1);
    }
  };
  stepShot(g.playerShots,'player'); stepShot(g.enemyShots,'enemy');
}

export function stepZona(g,dt,input={}){
  if(!g||g.lost||g.won) return;
  dt=clamp(Number(dt)||0,0,.055); const world=makeZonaWorld(g.seed);
  g.damageCooldown=Math.max(0,g.damageCooldown-dt); g.shotCooldown=Math.max(0,g.shotCooldown-dt); g.flash=Math.max(0,g.flash-dt); g.weaponFlash=Math.max(0,g.weaponFlash-dt); g.noticeTime=Math.max(0,g.noticeTime-dt);
  if(g.countdown>0){ g.countdown=Math.max(0, g.countdown-dt); if(g.countdown===0) message(g,'¡ADELANTE!',1.0); return; }
  g.time+=dt; g.remaining=Math.max(0, ZONA_SECONDS-g.time); if(!g.remaining){g.lost=true; message(g,'SE HA AGOTADO EL TIEMPO',5); return;}

  g.a=norm(g.a + clamp(Number(input.turn)||0,-1,1)*2.15*dt + clamp(Number(input.lookDelta)||0,-.32,.32));
  const f=clamp(Number(input.forward)||0,-1,1), side=clamp(Number(input.side)||0,-1,1); const mag=Math.max(1,Math.hypot(f,side)), speed=2.6*dt/mag;
  const dx=(Math.cos(g.a)*f-Math.sin(g.a)*side)*speed, dy=(Math.sin(g.a)*f+Math.cos(g.a)*side)*speed;
  if(movable(world,g.x+dx,g.y,g.hasKey)) g.x+=dx; if(movable(world,g.x,g.y+dy,g.hasKey)) g.y+=dy;

  world.items.forEach((o,i)=>{ if(consumed(g,i)||dist(g,o)>.49) return; g.itemsMask|=(1<<i);
    if(o.type==='material'){g.materials++;g.score+=100;message(g,'MATERIAL RECUPERADO +100');}
    if(o.type==='especial'){g.materials++;g.score+=250;message(g,'MATERIAL ESPECIAL +250');}
    if(o.type==='tarjeta'){g.hasKey=true;message(g,'TARJETA DE ACCESO ENCONTRADA');}
    if(o.type==='bateria'){g.ammo=Math.min(18,g.ammo+7);message(g,'BATERÍA +7 DISPAROS');}
    if(o.type==='botiquin'){g.health=Math.min(3,g.health+1);message(g,'BOTIQUÍN +1 SALUD');}
  });

  (world.barrels||[]).forEach((b,i)=>{ if(barrelGone(g,i)) return; if(dist(g,b)<.40) hurt(g,1); });

  g.enemies.forEach((e)=>{
    if(e.hp<=0){ e.deadTime += dt; e.moving=false; return; }
    e.cooldown=Math.max(0,e.cooldown-dt); e.moving=false; const d=dist(g,e);
    if(d<.72){ hurt(g,1); }
    if(d<6.2 && lineOfSight(world,g.x,g.y,e.x,e.y,g.hasKey)){
      if(d>1.9){
        const step=Math.min(.76*dt, Math.max(0,d-.86)), ux=(g.x-e.x)/d, uy=(g.y-e.y)/d;
        let moved=false; if(movable(world,e.x+ux*step,e.y,g.hasKey)){ e.x+=ux*step; moved=true; }
        if(movable(world,e.x,e.y+uy*step,g.hasKey)){ e.y+=uy*step; moved=true; }
        e.moving=moved;
      }
      if(d<4.8 && e.cooldown<=0){ spawnEnemyShot(g,e); e.cooldown=1.35 + ((e.x*13+e.y*7)%1)*0.55; }
    }
  });

  advanceShots(g, world, dt);
}

export function packZonaState(g){ return {
  seed:g.seed,x:+g.x.toFixed(3),y:+g.y.toFixed(3),a:+g.a.toFixed(3), health:g.health, ammo:g.ammo,
  remaining:Math.ceil(g.remaining), time:+g.time.toFixed(2), score:g.score, materials:g.materials, hasKey:g.hasKey,
  itemsMask:g.itemsMask, barrelsMask:g.barrelsMask, countdown:+g.countdown.toFixed(2), weaponFlash:+g.weaponFlash.toFixed(2),
  enemies:g.enemies.map(e=>({x:+e.x.toFixed(2),y:+e.y.toFixed(2),hp:e.hp,moving:!!e.moving,deadTime:+e.deadTime.toFixed(2)})),
  playerShots:g.playerShots.map(s=>({x:+s.x.toFixed(2),y:+s.y.toFixed(2)})), enemyShots:g.enemyShots.map(s=>({x:+s.x.toFixed(2),y:+s.y.toFixed(2)})),
  notice:g.noticeTime>0?g.notice:'', won:g.won, lost:g.lost, showMap:!!g.showMap
}; }

function rounded(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill; ctx.beginPath(); if(ctx.roundRect){ctx.roundRect(x,y,w,h,r);} else {ctx.rect(x,y,w,h);} ctx.fill();}
function projectSprite(ctx,obj,rx,ry,dir,plane,zBuffer,asset,size=1){
  const tx=obj.x-rx, ty=obj.y-ry, det=1/(plane.x*dir.y-dir.x*plane.y); const transX=det*(dir.y*tx-dir.x*ty), transY=det*(-plane.y*tx+plane.x*ty); if(transY<=.2) return;
  const center=Math.round(ZONA_W/2*(1+transX/transY)); const h=Math.abs(Math.round(ZONA_H/transY*size*.73)), w=h; const top=Math.round((ZONA_H-h)/2), left=center-w/2;
  if(center+w/2<0||center-w/2>=ZONA_W) return; const image=pics[asset];
  const tint=asset==='robot1'||asset==='robot2'?'#b3c5a4':asset==='salida'?'#c7e4a4':asset==='material'?'#8fd0d4':asset==='especial'?'#ddc87f':asset==='shotEnemy'?'#ff7b7b':asset==='shotPlayer'?'#ffef88':asset==='barril'?'#6cab64':asset==='barrilRoto'?'#756a58':asset==='tarjeta'?'#f6d75a':'#c6cda0';
  for(let px=Math.max(0,Math.floor(left)); px<Math.min(ZONA_W,Math.ceil(left+w)); px+=2){ if(transY>=zBuffer[Math.floor(px/2)]-.08) continue;
    if(image){const sx=Math.floor((px-left)/w*image.width); ctx.drawImage(image, clamp(sx,0,image.width-1),0,1,image.height, px,top,2,h);} else {ctx.fillStyle=tint; ctx.fillRect(px,top,2,h);} }
}

export function drawZona(canvas,state,settings={}){
  const ctx=canvas.getContext('2d'); if(!ctx) return;
  const world=makeZonaWorld(state.seed); const pX=Number(state.x??1.5), pY=Number(state.y??1.5), a=Number(state.a??0);
  const dir={x:Math.cos(a),y:Math.sin(a)}, plane={x:-dir.y*Math.tan(FOV/2), y:dir.x*Math.tan(FOV/2)};
  ctx.fillStyle='#27332d'; ctx.fillRect(0,0,ZONA_W,ZONA_H/2);
  const gradient=ctx.createLinearGradient(0,ZONA_H/2,0,ZONA_H); gradient.addColorStop(0,'#3d483c'); gradient.addColorStop(1,'#151d18'); ctx.fillStyle=gradient; ctx.fillRect(0,ZONA_H/2,ZONA_W,ZONA_H/2);
  // Marcas del suelo que se desplazan hacia el jugador
  ctx.strokeStyle='rgba(180,190,160,.18)'; ctx.lineWidth=2;
  for(let i=0;i<12;i++){ const y=ZONA_H/2+18+i*13; const shift=((Number(state.time||0)*120 + i*43)%180); ctx.beginPath(); ctx.moveTo(20+shift,y); ctx.lineTo(90+shift,y); ctx.stroke(); }
  const depths=new Float32Array(ZONA_W/2);
  for(let col=0; col<ZONA_W/2; col++){
    const cameraX=2*col/(ZONA_W/2)-1, dx=dir.x+plane.x*cameraX, dy=dir.y+plane.y*cameraX;
    let mx=Math.floor(pX), my=Math.floor(pY), side=0, hit=0; const deltaX=Math.abs(1/(dx||1e-8)), deltaY=Math.abs(1/(dy||1e-8)); const sx=dx<0?-1:1, sy=dy<0?-1:1;
    let sideX=dx<0?(pX-mx)*deltaX:(mx+1-pX)*deltaX, sideY=dy<0?(pY-my)*deltaY:(my+1-pY)*deltaY;
    for(let iter=0; iter<40; iter++){
      if(sideX<sideY){ sideX+=deltaX; mx+=sx; side=0; } else { sideY+=deltaY; my+=sy; side=1; }
      if(mx<0||my<0||mx>=CELL||my>=CELL){ hit=1; break; }
      const tile=world.map[my][mx]; if(tile===1 || (tile===2&&!state.hasKey)){ hit=tile; break; }
    }
    const d=clamp(side===0?sideX-deltaX:sideY-deltaY,.08,MAX_RAY); depths[col]=d; if(!hit) continue;
    const height=Math.min(1000,Math.round(ZONA_H/d)); const top=Math.round((ZONA_H-height)/2); const keyName=hit===2?'puerta':side===0?'hormigon':'metal'; const image=pics[keyName];
    let wallHit=side===0?pY+d*dy:pX+d*dx; wallHit-=Math.floor(wallHit); if((side===0&&dx>0)||(side===1&&dy<0)) wallHit=1-wallHit; const shade=clamp(1-d/19,.18,1)*(side===1?.77:1);
    if(image){ ctx.drawImage(image, clamp(Math.floor(wallHit*image.width),0,image.width-1),0,1,image.height,col*2,top,2,height); ctx.fillStyle=`rgba(0,0,0,${1-shade})`; ctx.fillRect(col*2,top,2,height); }
    else { ctx.fillStyle=hit===2?'#8f8158':side===0?'#687c69':'#566755'; ctx.fillRect(col*2,top,2,height); ctx.fillStyle=`rgba(0,0,0,${1-shade})`; ctx.fillRect(col*2,top,2,height); }
  }

  const entities=[];
  world.items.forEach((o,i)=>{ if(!((Number(state.itemsMask||0)>>>i)&1)) entities.push({x:o.x,y:o.y,asset:o.type==='especial'?'especial':o.type,scale:.52}); });
  (world.barrels||[]).forEach((b,i)=> entities.push({x:b.x,y:b.y,asset:((Number(state.barrelsMask||0)>>>i)&1)?'barrilRoto':'barril',scale:.54}));
  (state.enemies||[]).forEach(e=>{ if(e.hp>0) entities.push({x:e.x,y:e.y,asset:e.moving?((Math.floor(Number(state.time||0)*8)%2)?'robot2':'robot1'):'robot1',scale:.87}); else entities.push({x:e.x,y:e.y,asset:'robotDead',scale:.87}); });
  (state.playerShots||[]).forEach(s=>entities.push({x:s.x,y:s.y,asset:'shotPlayer',scale:.16}));
  (state.enemyShots||[]).forEach(s=>entities.push({x:s.x,y:s.y,asset:'shotEnemy',scale:.16}));
  entities.push({x:world.exit.x,y:world.exit.y,asset:'salida',scale:.68});
  entities.sort((a,b)=>((b.x-pX)**2+(b.y-pY)**2)-((a.x-pX)**2+(a.y-pY)**2));
  for(const obj of entities) projectSprite(ctx,obj,pX,pY,dir,plane,depths,obj.asset,obj.scale);

  // mira
  ctx.strokeStyle='rgba(235,245,216,.82)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(309,180); ctx.lineTo(316,180); ctx.moveTo(324,180); ctx.lineTo(331,180); ctx.moveTo(320,169); ctx.lineTo(320,176); ctx.moveTo(320,184); ctx.lineTo(320,191); ctx.stroke();
  const gun = state.weaponFlash>0 && pics.armaDisparo ? pics.armaDisparo : pics.arma;
  if(gun) ctx.drawImage(gun,232,243,184,119); else {rounded(ctx,290,290,60,80,8,'#3d5140'); rounded(ctx,300,265,39,43,5,'#9cb481');}
  if(settings.flash||state.flash>0){ ctx.fillStyle='rgba(228,240,149,.13)'; ctx.fillRect(0,0,ZONA_W,ZONA_H); }
  if(state.notice){ rounded(ctx,130,45,380,32,5,'rgba(9,25,13,.84)'); ctx.fillStyle='#f0f0ce'; ctx.font='bold 14px monospace'; ctx.textAlign='center'; ctx.fillText(String(state.notice).slice(0,48),320,65); }
  if(settings.map||state.showMap){ const sc=5, ox=ZONA_W-CELL*sc-13, oy=80; rounded(ctx,ox-6,oy-6,CELL*sc+12,CELL*sc+12,5,'rgba(6,17,8,.83)');
    for(let y=0;y<CELL;y++)for(let x=0;x<CELL;x++){ ctx.fillStyle=world.map[y][x]===1?'#4c6250':world.map[y][x]===2?'#c8af64':'#1d3122'; ctx.fillRect(ox+x*sc,oy+y*sc,sc-1,sc-1); }
    (world.barrels||[]).forEach((b,i)=>{ctx.fillStyle=((Number(state.barrelsMask||0)>>>i)&1)?'#63584b':'#69b06e'; ctx.fillRect(ox+b.x*sc-2,oy+b.y*sc-2,4,4);});
    ctx.fillStyle='#f6db74'; ctx.fillRect(ox+world.exit.x*sc-2,oy+world.exit.y*sc-2,4,4); ctx.fillStyle='#e3f2d8'; ctx.beginPath(); ctx.arc(ox+pX*sc,oy+pY*sc,3,0,2*Math.PI); ctx.fill(); ctx.strokeStyle='#e3f2d8'; ctx.beginPath(); ctx.moveTo(ox+pX*sc,oy+pY*sc); ctx.lineTo(ox+(pX+Math.cos(a))*sc,oy+(pY+Math.sin(a))*sc); ctx.stroke(); }
  rounded(ctx,8,8,392,29,6,'rgba(8,19,12,.85)'); ctx.fillStyle='#eef4df'; ctx.font='bold 14px monospace'; ctx.textAlign='left';
  ctx.fillText(`❤ ${state.health??3}   ⚡ ${state.ammo??9}   ♻ ${state.materials??0}/4   ${state.hasKey?'🔑':'🔒'}   ⏱ ${state.remaining??210}s`,18,28);
  rounded(ctx,8,327,235,27,5,'rgba(8,19,12,.84)'); ctx.fillStyle='#e9f2d4'; ctx.fillText(`PUNTOS  ${state.score||0}`,19,346);
  if(Number(state.countdown||0)>0){
    ctx.fillStyle='rgba(4,12,6,.55)'; ctx.fillRect(0,0,ZONA_W,ZONA_H); rounded(ctx,237,104,166,108,10,'rgba(30,53,37,.95)');
    ctx.strokeStyle='#a9c69f'; ctx.strokeRect(237,104,166,108); ctx.textAlign='center'; ctx.fillStyle='#f2f7e6'; ctx.font='bold 18px monospace'; ctx.fillText('PREPÁRATE',320,132);
    ctx.font='bold 58px monospace'; const n=Math.ceil(Number(state.countdown)); ctx.fillText(n>0?n:'¡YA!',320,184);
    ctx.font='14px monospace'; ctx.fillText('CLICK PARA CAPTURAR RATÓN · ESC PARA LIBERAR',320,204);
  }
  if(state.won||state.lost){ ctx.fillStyle='rgba(4,12,6,.68)'; ctx.fillRect(0,0,ZONA_W,ZONA_H); rounded(ctx,104,125,432,99,9,'#283d2d'); ctx.strokeStyle='#a9c69f'; ctx.strokeRect(104,125,432,99); ctx.textAlign='center'; ctx.font='bold 25px monospace'; ctx.fillStyle='#e5f0dd'; ctx.fillText(state.won?'MISIÓN COMPLETADA':'FIN DE PARTIDA',320,168); ctx.font='18px monospace'; ctx.fillText(`${state.score||0} PUNTOS`,320,199); }
}
