/* V19: adaptador para la página de juego del TRASA Arcade V18. No modifica Memory, Run, Zona ni Snake. */
import {createInvaders,stepInvaders,packInvadersState,drawInvadersScene,INVADERS_WIDTH,INVADERS_HEIGHT} from './arcade-invaders.js?v=19';
import {loadFirebase,roomPath,isFirebaseConfigured} from './common.js';
const $=id=>document.getElementById(id);
const startBtn=$('startInvaders'),lobby=$('arcadeLobby'),play=$('arcadePlayArea'),root=$('gameRoot'),nick=$('nickname');
const end=$('gameEnd'),score=$('playerScore'),clock=$('playerClock'),headline=$('playerGameTitle');
let fb=null,uid='',roomOpen=false,blocked=false,game=null,frame=0,prev=0,lastSync=0,liveWrites=Promise.resolve(),closing=false,saving=false;
const held=new Set();
const path=part=>roomPath('arcade/'+part);
function diagnostic(msg){let el=$('invadersFirebaseError');if(!el){el=document.createElement('p');el.id='invadersFirebaseError';el.className='invaders-warning';root?.parentElement?.append(el);}if(el)el.textContent=msg;console.warn('TRASA INVADERS:',msg);}
function clearDiagnostic(){document.getElementById('invadersFirebaseError')?.remove();}
function canStart(){if(startBtn)startBtn.disabled=!(fb&&uid&&roomOpen&&!blocked&&!game&&lobby&&!lobby.classList.contains('hidden'));}
function active(){return game&&!closing&&!['won','lost'].includes(game.phase);}
function paint(){if(!game)return;const canvas=$('trasaInvadersCanvas');if(canvas)drawInvadersScene(canvas,packInvadersState(game));score.textContent=`PUNTOS: ${game.score}`;clock.textContent=`OLEADA ${game.wave}/5 · VIDAS ${game.lives} · ${Math.floor(game.elapsed)} s`;}
function syncLive(force=false,status='playing'){
 if(!fb||!game||blocked||closing)return liveWrites;
 const now=Date.now();if(!force&&now-lastSync<300)return liveWrites;lastSync=now;
 const snapshot={gameId:'invaders',name:game.name,status,score:game.score,startedAt:game.startedAt,
   updatedAt:fb.dbMod.serverTimestamp(),state:JSON.stringify(packInvadersState(game))};
 const reference=fb.dbMod.ref(fb.db,path('live/'+uid));
 liveWrites=liveWrites.catch(()=>{}).then(()=>fb.dbMod.set(reference,snapshot))
   .then(()=>clearDiagnostic()).catch(e=>diagnostic('Firebase no permite retransmitir TRASA INVADERS en arcade/live. Revisa las reglas nuevas: '+e.message));
 return liveWrites;
}
async function saveScore(g){
 if(!fb||!g||blocked||saving)return;saving=true;
 try{
   await fb.dbMod.runTransaction(fb.dbMod.ref(fb.db,path('scores/invaders/'+uid)),current=>{
     if(current&&Number(current.score)>g.score)return;
     return {name:g.name,score:g.score,updatedAt:Date.now()};
   });
   const ref=fb.dbMod.push(fb.dbMod.ref(fb.db,path('history/invaders/'+uid)));
   await fb.dbMod.set(ref,{name:g.name,score:g.score,finishedAt:fb.dbMod.serverTimestamp()});
 }catch(e){diagnostic('No se pudo guardar la puntuación de TRASA INVADERS. Revisa Firebase scores/invaders y history/invaders: '+e.message);}
 finally{saving=false;}
}
function stop(){cancelAnimationFrame(frame);frame=0;prev=0;held.clear();}
async function exitInvaders(){
 if(!game)return;closing=true;stop();game=null;
 if(fb&&uid){try{await liveWrites.catch(()=>{});await fb.dbMod.remove(fb.dbMod.ref(fb.db,path('live/'+uid)));}catch(e){diagnostic('No se pudo cerrar la sesión de Invaders: '+e.message);}}
 root.replaceChildren();root.classList.remove('hidden');play.classList.add('hidden');lobby.classList.remove('hidden');end.classList.add('hidden');closing=false;canStart();
}
function finish(){
 if(!game)return;const finalGame=game;stop();paint();
 $('endScore').textContent=String(game.score);
 $('endText').textContent=game.phase==='won'?'¡Has defendido TRASA de los marcianos!':'¡Los marcianos han superado las defensas de TRASA!';
 root.classList.add('hidden');end.classList.remove('hidden');
 syncLive(true,'finished').then(()=>saveScore(finalGame)).catch(e=>diagnostic(e.message));
}
function loop(t){
 if(!active())return;
 const dt=prev?Math.min(.06,(t-prev)/1000):0;prev=t;
 const move=Number(held.has('left')? -1:0)+Number(held.has('right')?1:0);
 stepInvaders(game,dt,{move,shoot:held.has('fire')});paint();
 if(['won','lost'].includes(game.phase)){finish();return;}
 syncLive();frame=requestAnimationFrame(loop);
}
function inputButton(which,label){
 const button=document.createElement('button');button.type='button';button.className='invaders-'+which;button.textContent=label;
 button.setAttribute('aria-label',which==='fire'?'Disparar':which==='left'?'Izquierda':'Derecha');
 button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);held.add(which);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>held.delete(which));
 return button;
}
function startInvaders(){
 if(startBtn.disabled||game||!fb||!roomOpen||blocked||lobby.classList.contains('hidden'))return;
 const name=String(nick.value||'').trim().replace(/\s+/g,' ').slice(0,18);
 if(name.length<2){$('roomStatus').textContent='Escribe un nombre de al menos 2 caracteres.';nick.focus();return;}
 try{localStorage.setItem('trasa-arcade-nick',name);}catch{}
 clearDiagnostic();game=createInvaders();game.name=name;game.startedAt=Date.now();lastSync=0;closing=false;
 headline.textContent='TRASA INVADERS';lobby.classList.add('hidden');play.classList.remove('hidden');root.classList.remove('hidden');end.classList.add('hidden');root.replaceChildren();
 const wrapper=document.createElement('div');wrapper.className='invaders-game-box';
 const help=document.createElement('p');help.textContent='← → / A D PARA MOVERTE · ESPACIO PARA DISPARAR · MÓVIL: MANTÉN LOS BOTONES';
 const canvas=document.createElement('canvas');canvas.id='trasaInvadersCanvas';canvas.width=INVADERS_WIDTH;canvas.height=INVADERS_HEIGHT;
 canvas.setAttribute('aria-label','TRASA INVADERS: defender el almacén de TRASA de los marcianos');
 const pad=document.createElement('div');pad.className='invaders-pad';
 pad.append(inputButton('left','◀'),inputButton('fire','● DISPARAR'),inputButton('right','▶'));
 wrapper.append(help,canvas,pad);root.append(wrapper);paint();syncLive(true);canStart();frame=requestAnimationFrame(loop);
}
const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'fire',ArrowUp:'fire',KeyW:'fire'};
window.addEventListener('keydown',e=>{if(!active())return;const key=keys[e.code];if(!key)return;e.preventDefault();held.add(key);});
window.addEventListener('keyup',e=>{if(keys[e.code])held.delete(keys[e.code]);});
window.addEventListener('blur',()=>held.clear());
startBtn?.addEventListener('click',startInvaders);
$('exitCurrentGame')?.addEventListener('click',()=>{if(game)exitInvaders();});
$('backToGames')?.addEventListener('click',()=>{if(game)exitInvaders();});
async function init(){
 if(!isFirebaseConfigured()){diagnostic('Firebase no está configurado.');return;}
 try{
   fb=await loadFirebase();const account=await fb.authMod.signInAnonymously(fb.auth);uid=account.user.uid;
   fb.dbMod.onValue(fb.dbMod.ref(fb.db,roomPath('display')),s=>{roomOpen=(s.val()||{}).mode==='arcade';if(!roomOpen&&game)exitInvaders();canStart();},e=>diagnostic('No puedo comprobar si el Arcade está abierto: '+e.message));
   fb.dbMod.onValue(fb.dbMod.ref(fb.db,path('bans/'+uid)),s=>{blocked=s.exists();if(blocked&&game)exitInvaders();canStart();},e=>diagnostic('No puedo comprobar bloqueos: '+e.message));
   fb.dbMod.onValue(fb.dbMod.ref(fb.db,path('resetAt')),s=>{if(game&&Number(s.val()||0)>=game.startedAt)exitInvaders();},e=>console.warn(e));
 }catch(e){diagnostic('Error conectando TRASA INVADERS con Firebase: '+e.message);}
 canStart();
}
init();
