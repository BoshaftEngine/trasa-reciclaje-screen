/* TRASA SNAKE · retransmisión compatible con la pantalla del Arcade V13.
   Solo superpone la partida de Snake y dibuja su ranking, no toca otros juegos. */
import {drawSnakeScene,SNAKE_CANVAS} from './arcade-snake.js?v=15';
import {loadFirebase,roomPath,isFirebaseConfigured} from './common.js';
const primary=document.getElementById('arcadeStage'),overlay=document.getElementById('snakeFeaturedStage');
const board=document.getElementById('arcadeSnakeRank'),arcade=document.getElementById('arcadeView');
let live={},display={},currentUid='',canvas=null,info=null,raf=0,last=0,gameState=null;
const safe=value=>{try{return JSON.parse(value||'{}');}catch{return {};}};
function renderRanking(val){
 if(!board)return;board.replaceChildren();
 const players=Object.values(val||{}).filter(x=>x&&typeof x.name==='string'&&Number.isFinite(Number(x.score))).sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,5);
 if(!players.length){board.textContent='Todavía no hay récords';return;}
 players.forEach((p,i)=>{const row=document.createElement('div');row.className='arcade-rank-row';const a=document.createElement('span');a.textContent=`${i+1}. ${String(p.name).slice(0,18)}`;const b=document.createElement('strong');b.textContent=String(p.score);row.append(a,b);board.append(row);});
}
function showSnake(p,uid){
 if(!overlay||!primary)return;
 primary.classList.add('snake-hide');overlay.classList.remove('hidden');
 if(currentUid!==uid||!canvas){
  currentUid=uid;overlay.replaceChildren();info=document.createElement('div');info.className='arcade-stage-meta';canvas=document.createElement('canvas');canvas.width=canvas.height=SNAKE_CANVAS;overlay.append(info,canvas);
 }
 gameState=safe(p.state);info.textContent=`${p.name} · ${p.score||0} PUNTOS · ♻ ${gameState.foods||0}`;
 drawSnakeScene(canvas,gameState);
}
function hideSnake(){
 if(!overlay||!primary)return;
 primary.classList.remove('snake-hide');overlay.classList.add('hidden');currentUid='';gameState=null;canvas=null;
}
function reconcile(){
 if(display.mode!=='arcade'){hideSnake();return;}
 const now=Date.now();const fresh=Object.entries(live).filter(([uid,p])=>p&&p.status==='playing'&&p.gameId==='snake'&&Number(p.updatedAt||0)>now-22000);
 const selected=display.featuredUid && live[display.featuredUid];
 if(selected){if(selected.gameId==='snake'&&selected.status==='playing'&&Number(selected.updatedAt||0)>now-22000)showSnake(selected,display.featuredUid);else hideSnake();return;}
 // Si no hay jugador destacado, dar preferencia a Snake solo cuando sea el único tipo de partida activo.
 const others=Object.values(live).some(p=>p&&p.gameId!=='snake'&&p.status==='playing'&&Number(p.updatedAt||0)>now-22000);
 if(!others&&fresh.length){showSnake(fresh[0][1],fresh[0][0]);return;}
 hideSnake();
}
async function init(){if(!isFirebaseConfigured())return;try{
 const f=await loadFirebase();await f.authMod.signInAnonymously(f.auth);
 f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('display')),snap=>{display=snap.val()||{};reconcile();});
 f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('arcade/live')),snap=>{live=snap.val()||{};reconcile();});
 f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('arcade/scores/snake')),snap=>renderRanking(snap.val()));
 setInterval(reconcile,7000);
 }catch(error){console.warn('TRASA SNAKE pantalla:',error);if(board)board.textContent='Revisa las reglas Firebase de Snake';}}
init();
