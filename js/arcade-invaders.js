/* TRASA INVADERS V19 — motor compartido entre jugador y proyector.
   Cinco oleadas, disparos, escudos que se rompen y nave de bonificación.
   Canvas independiente y sprites PNG intercambiables en assets/trasa-invaders/. */
export const INVADERS_WIDTH=640;
export const INVADERS_HEIGHT=480;
export const INVADERS_WAVES=5;
const COLS=9,ROWS=5,GAP_X=45,GAP_Y=32,LEFT=92,TOP=89;
const SHIELD_WIDTH=14,SHIELD_CELL=13,SHIELD_Y=345;
export const INVADERS_ASSETS={
  player:'assets/trasa-invaders/nave-jugador.png',
  damaged:'assets/trasa-invaders/nave-danada.png',
  alien1:'assets/trasa-invaders/marciano-1.png',
  alien2:'assets/trasa-invaders/marciano-2.png',
  alien3:'assets/trasa-invaders/marciano-3.png',
  bullet:'assets/trasa-invaders/disparo-jugador.png',
  enemyBullet:'assets/trasa-invaders/disparo-marciano.png',
  shield:'assets/trasa-invaders/escudo.png',
  ufo:'assets/trasa-invaders/nave-jefe.png',
  explosion:'assets/trasa-invaders/explosion.png',
  bg:'assets/trasa-invaders/fondo.png'
};
const sprites={};
if(typeof Image!=='undefined')for(const [key,path] of Object.entries(INVADERS_ASSETS)){
  const img=new Image();sprites[key]=img;img.src=path+'?v=19';
}
const clamp=(a,min,max)=>Math.min(max,Math.max(min,a));
const rand=(random=Math.random)=>clamp(Number(random())||0,0,.999999);
const shieldGeometry=()=>{
  const cells=[];
  for(let b=0;b<4;b++)for(let row=0;row<3;row++)for(let col=0;col<5;col++){
    if(row===2&&col===2)continue;
    cells.push({id:b*14+row*5+col-(row===2&&col>2?1:0),x:78+b*139+col*SHIELD_CELL,y:SHIELD_Y+row*SHIELD_CELL});
  }
  return cells;
};
const shields=shieldGeometry();
function allAliens(g){
 const list=[];for(let id=0;id<COLS*ROWS;id++)if(!g.dead.has(id)){
   const row=Math.floor(id/COLS),col=id%COLS;
   list.push({id,row,col,x:g.groupX+col*GAP_X,y:g.groupY+row*GAP_Y});
 }
 return list;
}
function setupWave(g){
 g.phase='starting';g.countdown=2.6;g.groupX=LEFT;g.groupY=TOP+Math.min(g.wave-1,4)*8;
 g.direction=1;g.dead=new Set();g.shieldDead=new Set();g.playerBullets=[];g.enemyBullets=[];g.explosions=[];
 g.ufo=null;g.ufoTimer=12+rand(g.random)*5;g.fireTimer=1.1;g.waveMessage=2.4;
 g.x=INVADERS_WIDTH/2;g.shotCooldown=0;g.invulnerable=1.0;
}
export function createInvaders(random=Math.random){
 const g={random,score:0,lives:3,wave:1,elapsed:0,waveMessage:0,shotCooldown:0,invulnerable:0,
   x:INVADERS_WIDTH/2,phase:'starting',direction:1, groupX:LEFT,groupY:TOP,
   dead:new Set(),shieldDead:new Set(),playerBullets:[],enemyBullets:[],explosions:[],ufo:null,ufoTimer:0,fireTimer:0,reason:''};
 setupWave(g);return g;
}
const boxHit=(x,y,rect)=>x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h;
const shipHit=(p,x,y,half=19)=>Math.abs(p.x-x)<half&&Math.abs(p.y-y)<13;
const shieldHit=(g,x,y)=>{
 for(const cell of shields){if(g.shieldDead.has(cell.id))continue;
   if(boxHit(x,y,{x:cell.x,y:cell.y,w:SHIELD_CELL,h:SHIELD_CELL})){
     g.shieldDead.add(cell.id);return true;
   }
 }
 return false;
};
export function stepInvaders(g,delta,controls={}){
 if(!g||g.phase==='won'||g.phase==='lost')return;
 const dt=clamp(Number(delta)||0,0,.06);
 g.elapsed+=dt;
 g.waveMessage=Math.max(0,g.waveMessage-dt);
 g.invulnerable=Math.max(0,g.invulnerable-dt);
 g.shotCooldown=Math.max(0,g.shotCooldown-dt);
 g.explosions=g.explosions.filter(e=>(e.ttl-=dt)>0);
 if(g.phase==='starting'){g.countdown=Math.max(0,g.countdown-dt);if(g.countdown===0)g.phase='playing';return;}
 if(g.phase==='intermission'){g.countdown=Math.max(0,g.countdown-dt);if(g.countdown===0)setupWave(g);return;}
 const move=clamp(Number(controls.move)||0,-1,1);
 g.x=clamp(g.x+move*265*dt,26,INVADERS_WIDTH-26);
 if(controls.shoot&&g.shotCooldown<=0&&g.playerBullets.length<3){
   g.playerBullets.push({x:g.x,y:413});g.shotCooldown=.23;
 }
 const enemies=allAliens(g);
 const speed=(21+(g.wave-1)*8)+(45-enemies.length)*.45;
 g.groupX+=g.direction*speed*dt;
 const updated=allAliens(g);
 const xs=updated.map(e=>e.x);
 if(xs.length){
   if((g.direction>0&&Math.max(...xs)+26>=INVADERS_WIDTH-25)||
       (g.direction<0&&Math.min(...xs)-18<=20)){
       g.groupX-=g.direction*speed*dt;g.direction*=-1;g.groupY+=13;
   }
   if(updated.some(e=>e.y+22>=397)){g.phase='lost';g.reason='Los marcianos han llegado a TRASA';return;}
 }
 // Nave especial periódica a la que disparar para ganar puntos extra.
 g.ufoTimer-=dt;
 if(!g.ufo&&g.ufoTimer<=0){g.ufo={x:-40,y:43};g.ufoTimer=19+rand(g.random)*5;}
 if(g.ufo){g.ufo.x+=(82+g.wave*10)*dt;if(g.ufo.x>INVADERS_WIDTH+50)g.ufo=null;}
 g.fireTimer-=dt;
 if(g.fireTimer<=0&&updated.length){
   const chosen=updated[Math.floor(rand(g.random)*updated.length)];
   if(g.enemyBullets.length<9)g.enemyBullets.push({x:chosen.x+6,y:chosen.y+18});
   g.fireTimer=Math.max(.32,1.4-.15*g.wave)+rand(g.random)*.65;
 }
 // Proyectiles propios: barreras, platillos y marcianos.
 for(const b of g.playerBullets)b.y-=425*dt;
 g.playerBullets=g.playerBullets.filter(b=>{
   if(b.y<20)return false;
   if(shieldHit(g,b.x,b.y))return false;
   if(g.ufo&&Math.abs(g.ufo.x-b.x)<25&&Math.abs(g.ufo.y-b.y)<15){
     g.explosions.push({x:g.ufo.x,y:g.ufo.y,ttl:.45});g.ufo=null;g.score+=150;return false;
   }
   const alien=allAliens(g).find(e=>Math.abs(e.x+6-b.x)<18&&Math.abs(e.y+9-b.y)<14);
   if(alien){g.dead.add(alien.id);g.score+=alien.row<1?30:alien.row<3?20:10;
     g.explosions.push({x:alien.x+6,y:alien.y+8,ttl:.28});return false;
   }
   return true;
 });
 for(const b of g.enemyBullets)b.y+=(180+g.wave*24)*dt;
 g.enemyBullets=g.enemyBullets.filter(b=>{
   if(b.y>INVADERS_HEIGHT-15)return false;
   if(shieldHit(g,b.x,b.y))return false;
   if(g.invulnerable<=0&&Math.abs(b.x-g.x)<20&&Math.abs(b.y-427)<18){
     g.lives--;g.invulnerable=1.6;g.explosions.push({x:g.x,y:425,ttl:.42});
     if(g.lives<=0){g.phase='lost';g.reason='Te has quedado sin naves';}return false;
   }
   return true;
 });
 if(g.dead.size===45&&g.phase==='playing'){
   g.score+=100*g.wave;
   if(g.wave>=INVADERS_WAVES){g.phase='won';g.reason='¡Has defendido los materiales de TRASA!';}
   else {g.wave++;g.phase='intermission';g.countdown=1.4;}
 }
}
export function packInvadersState(g){return {
  wave:g.wave,phase:g.phase,score:g.score,lives:g.lives,elapsed:+g.elapsed.toFixed(1),
  x:+g.x.toFixed(1),groupX:+g.groupX.toFixed(1),groupY:+g.groupY.toFixed(1),
  direction:g.direction,dead:[...g.dead],shieldDead:[...g.shieldDead],
  playerBullets:g.playerBullets.map(b=>[+b.x.toFixed(0),+b.y.toFixed(0)]),
  enemyBullets:g.enemyBullets.map(b=>[+b.x.toFixed(0),+b.y.toFixed(0)]),
  ufo:g.ufo?[+g.ufo.x.toFixed(0),+g.ufo.y.toFixed(0)]:null,
  explosions:g.explosions.map(e=>[+e.x.toFixed(0),+e.y.toFixed(0),+e.ttl.toFixed(2)]),
  countdown:+(g.countdown||0).toFixed(1),reason:g.reason
};}
function sprite(ctx,name,x,y,w,h){
 const img=sprites[name];if(!img?.complete||!img.naturalWidth)return false;
 ctx.drawImage(img,x,y,w,h);return true;
}
const rect=(ctx,x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
function text(ctx,value,x,y,font='bold 16px monospace',color='#e5f0df',align='left'){
 ctx.fillStyle=color;ctx.textAlign=align;ctx.font=font;ctx.fillText(value,x,y);
}
export function drawInvadersScene(canvas,state={}){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const w=INVADERS_WIDTH,h=INVADERS_HEIGHT;
 const phase=state.phase||'starting',time=Number(state.elapsed)||0;
 const background=sprites.bg;
 if(background?.complete&&background.naturalWidth)ctx.drawImage(background,0,0,w,h);
 else {rect(ctx,0,0,w,h,'#101b13');for(let i=0;i<60;i++){
   const x=(i*161+19)%w,y=(i*73+41)%h;rect(ctx,x,y,2,2,'#466b4b');}}
 rect(ctx,0,0,w,34,'rgba(5,16,10,.84)');
 text(ctx,`TRASA INVADERS · ${state.score||0} PT`,16,24);
 text(ctx,`OLEADA ${state.wave||1}/${INVADERS_WAVES} · VIDAS ${'♥'.repeat(Math.max(0,Number(state.lives)||0))}`,w-18,24,'bold 16px monospace','#e5f0df','right');
 rect(ctx,14,448,w-28,2,'#708c67');
 // Barricadas protectoras, formadas por piezas reemplazables en PNG.
 const shieldDead=new Set(state.shieldDead||[]);
 for(const c of shields)if(!shieldDead.has(c.id)){
   if(!sprite(ctx,'shield',c.x,c.y,SHIELD_CELL,SHIELD_CELL))rect(ctx,c.x+1,c.y+1,SHIELD_CELL-2,SHIELD_CELL-2,'#548c62');
 }
 const dead=new Set(state.dead||[]);
 for(let id=0;id<COLS*ROWS;id++){
   if(dead.has(id))continue;
   const row=Math.floor(id/COLS),col=id%COLS;
   const x=Number(state.groupX??LEFT)+col*GAP_X,y=Number(state.groupY??TOP)+row*GAP_Y;
   const kind=row===0?'alien3':row<3?'alien2':'alien1';
   if(!sprite(ctx,kind,x-12,y-12,37,31)){
     rect(ctx,x-10,y-6,30,19,row===0?'#e0be75':row<3?'#86b9c7':'#a3c68a');
     rect(ctx,x-3,y+1,4,4,'#193321');rect(ctx,x+10,y+1,4,4,'#193321');
   }
 }
 if(state.ufo){let [x,y]=state.ufo;if(!sprite(ctx,'ufo',x-27,y-13,55,28))rect(ctx,x-27,y-13,55,22,'#d0a35b');}
 (state.playerBullets||[]).forEach(([x,y])=>{
   if(!sprite(ctx,'bullet',x-5,y-12,10,25))rect(ctx,x-3,y-11,6,17,'#f3dd74');
 });
 (state.enemyBullets||[]).forEach(([x,y])=>{
   if(!sprite(ctx,'enemyBullet',x-5,y-11,10,23))rect(ctx,x-3,y-8,6,17,'#e87963');
 });
 const damaged=(state.lives||0)<3;
 // Se mantiene el punto de apoyo de la nave en la zona baja de pantalla.
 if(state.phase!=='lost'||Math.floor(time*7)%2===0){
   const key=damaged?'damaged':'player';if(!sprite(ctx,key,Number(state.x??320)-30,399,60,46)){
     rect(ctx,Number(state.x??320)-26,417,52,25,'#86aa81');rect(ctx,Number(state.x??320)-12,401,24,20,'#b5d4a2');
   }
 }
 (state.explosions||[]).forEach(([x,y])=>{
   if(!sprite(ctx,'explosion',x-20,y-20,40,40)){
      ctx.strokeStyle='#f0c66d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.stroke();
   }
 });
 text(ctx,'← → / A D: MOVERSE    ESPACIO: DISPARAR',w/2,470,'12px monospace','#a6c19c','center');
 if(phase==='starting'||phase==='intermission'){
   rect(ctx,142,168,356,126,'rgba(9,24,13,.90)');
   text(ctx,`OLEADA ${state.wave||1}`,320,212,'bold 27px monospace','#dcecd1','center');
   text(ctx,String(Math.ceil(Number(state.countdown)||0)),320,269,'bold 46px monospace','#e6cb82','center');
 }
 if(phase==='lost'||phase==='won'){
   rect(ctx,105,158,430,152,'rgba(9,24,13,.94)');
   text(ctx,phase==='won'?'¡TRASA DEFENDIDA!':'FIN DE PARTIDA',320,205,'bold 28px monospace','#e5ecd2','center');
   text(ctx,`${state.score||0} PUNTOS`,320,240,'bold 25px monospace','#efcf7d','center');
   text(ctx,(state.reason||'').slice(0,42),320,277,'14px monospace','#c1d3ba','center');
 }
}
