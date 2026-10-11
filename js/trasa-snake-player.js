/* TRASA SNAKE V15 compatible con TRASA Arcade V13 publicado.
   Añade el cuarto juego sin modificar los scripts de los otros tres. */
import {createSnake,turnSnake,stepSnake,packSnakeState,drawSnakeScene,SNAKE_CANVAS} from './arcade-snake.js?v=15';
import {loadFirebase,roomPath,isFirebaseConfigured} from './common.js';
const $=id=>document.getElementById(id);
const startBtn=$('startSnake'),lobby=$('arcadeLobby'),play=$('arcadePlayArea'),root=$('gameRoot'),nick=$('nickname');
const end=$('gameEnd'),score=$('playerScore'),clock=$('playerClock'),headline=$('playerGameTitle');
let fb=null,uid='',roomOpen=false,blocked=false,snake=null,frame=0,prev=0,lastSync=0,liveWrites=Promise.resolve(),closing=false;
const path=part=>roomPath('arcade/'+part);
const gameActive=()=>snake && !snake.lost&&!snake.won&&!closing;
function canStart(){startBtn.disabled=!(fb&&uid&&roomOpen&&!blocked&&!snake&&lobby&&!lobby.classList.contains('hidden'));}
function repaint(){if(!snake)return;drawSnakeScene($('trasaSnakeCanvas'),packSnakeState(snake));score.textContent=`PUNTOS: ${snake.score}`;clock.textContent=`MATERIALES: ${snake.foods} · ${Math.floor(snake.elapsed)} s`;}
function syncLive(force=false,status='playing'){
 if(!fb||!snake||blocked||closing)return liveWrites;
 const now=Date.now();if(!force&&now-lastSync<250)return liveWrites;lastSync=now;
 const data={gameId:'snake',name:snake.name,status,score:snake.score,startedAt:snake.startedAt,updatedAt:fb.dbMod.serverTimestamp(),state:JSON.stringify(packSnakeState(snake))};
 const target=fb.dbMod.ref(fb.db,path('live/'+uid));
 liveWrites=liveWrites.catch(()=>{}).then(()=>fb.dbMod.set(target,data)).catch(e=>{console.warn('Snake live:',e);const el=$('roomStatus');if(el)el.textContent='SNAKE: no se retransmite la partida. Publica las reglas Firebase V16.';});
 return liveWrites;
}
async function saveResult(){
 if(!fb||!snake||blocked)return;
 const uidNow=uid,g=snake;
 try{
  const scores=fb.dbMod.ref(fb.db,path('scores/snake/'+uidNow));
  await fb.dbMod.runTransaction(scores,current=>{if(current&&Number(current.score)>g.score)return;return{name:g.name,score:g.score,updatedAt:Date.now()};});
  const h=fb.dbMod.push(fb.dbMod.ref(fb.db,path('history/snake/'+uidNow)));
  await fb.dbMod.set(h,{name:g.name,score:g.score,finishedAt:fb.dbMod.serverTimestamp()});
 }catch(error){console.warn('Reglas Firebase de SNAKE pendientes:',error);$('endText').textContent+=' · Error Firebase: no se guardó el récord. Publica las reglas V16.';}
}
function clean(){cancelAnimationFrame(frame);frame=0;prev=0;}
async function exitSnake(){
 if(!snake)return;closing=true;clean();snake=null;
 if(fb&&uid){const target=fb.dbMod.ref(fb.db,path('live/'+uid));try{await liveWrites.catch(()=>{});await fb.dbMod.remove(target);}catch(e){console.warn(e);}}
 root.replaceChildren();play.classList.add('hidden');lobby.classList.remove('hidden');end.classList.add('hidden');closing=false;canStart();
}
function finishSnake(){
 if(!snake)return;clean();
 $('endScore').textContent=String(snake.score);
 $('endText').textContent=snake.won?'¡Has reciclado todo el tablero!':'¡Buen reciclaje! Tu mejor marca se registra en el TOP 5 de TRASA SNAKE.';
 root.classList.add('hidden');end.classList.remove('hidden');
 syncLive(true,'finished').then(saveResult).catch(console.warn);
}
function loop(t){
 if(!gameActive())return;
 const dt=prev?Math.min(.08,(t-prev)/1000):0;prev=t;stepSnake(snake,dt);repaint();
 if(snake.lost||snake.won){finishSnake();return;}
 syncLive();frame=requestAnimationFrame(loop);
}
function startSnake(){
 if(startBtn.disabled||snake||!fb||!roomOpen||blocked||!lobby||lobby.classList.contains('hidden'))return;
 const name=String(nick.value||'').trim().replace(/\s+/g,' ').slice(0,18);
 if(name.length<2){$('roomStatus').textContent='Escribe un nombre de al menos 2 caracteres.';nick.focus();return;}
 try{localStorage.setItem('trasa-arcade-nick',name);}catch{}
 snake=createSnake();snake.name=name;snake.startedAt=Date.now();lastSync=0;closing=false;
 headline.textContent='TRASA SNAKE';lobby.classList.add('hidden');play.classList.remove('hidden');root.classList.remove('hidden');end.classList.add('hidden');root.replaceChildren();
 const box=document.createElement('div');box.className='snake-game-box';
 const help=document.createElement('p');help.textContent='FLECHAS O WASD · MÓVIL: BOTONES O DESLIZAR';
 const canvas=document.createElement('canvas');canvas.id='trasaSnakeCanvas';canvas.width=SNAKE_CANVAS;canvas.height=SNAKE_CANVAS;
 let start=null;
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;e.preventDefault();start={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);});
 canvas.addEventListener('pointerup',e=>{if(!start||start.id!==e.pointerId)return;let dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;turnSnake(snake,Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0));});
 const pad=document.createElement('div');pad.className='snake-pad';
 for(const [dir,label,css] of [[0,'▲','up'],[3,'◀','left'],[2,'▼','down'],[1,'▶','right']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=css;b.setAttribute('aria-label',css);b.addEventListener('pointerdown',e=>{e.preventDefault();turnSnake(snake,dir);});pad.append(b);}
 box.append(help,canvas,pad);root.append(box);repaint();syncLive(true);canStart();frame=requestAnimationFrame(loop);
}
window.addEventListener('keydown',e=>{
 if(!gameActive())return;
 const directions={ArrowUp:0,KeyW:0,ArrowRight:1,KeyD:1,ArrowDown:2,KeyS:2,ArrowLeft:3,KeyA:3};
 const dir=directions[e.code];if(dir===undefined)return;e.preventDefault();turnSnake(snake,dir);
});
startBtn.addEventListener('click',startSnake);
$('exitCurrentGame').addEventListener('click',()=>{if(snake)exitSnake();});
$('backToGames').addEventListener('click',()=>{if(snake)exitSnake();});
async function init(){
 if(!isFirebaseConfigured())return;
 try{
  fb=await loadFirebase();const a=await fb.authMod.signInAnonymously(fb.auth);uid=a.user.uid;
  fb.dbMod.onValue(fb.dbMod.ref(fb.db,roomPath('display')),snap=>{roomOpen=(snap.val()||{}).mode==='arcade';if(!roomOpen&&snake)exitSnake();canStart();});
  fb.dbMod.onValue(fb.dbMod.ref(fb.db,path('bans/'+uid)),snap=>{blocked=snap.exists();if(blocked&&snake)exitSnake();canStart();});
  fb.dbMod.onValue(fb.dbMod.ref(fb.db,path('resetAt')),snap=>{if(snake&&Number(snap.val()||0)>=snake.startedAt)exitSnake();});
 }catch(error){console.error('TRASA SNAKE Firebase:',error);startBtn.title='Error al conectar Firebase';}
 canStart();
}
init();
