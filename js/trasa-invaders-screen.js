/* V19: proyector para Invaders, compatible con la pantalla principal de TRASA Arcade V18. */
import {drawInvadersScene,INVADERS_WIDTH,INVADERS_HEIGHT} from './arcade-invaders.js?v=19';
import {loadFirebase,roomPath,isFirebaseConfigured} from './common.js';
const root=document.getElementById('arcadeView'),main=document.getElementById('arcadeStage');
const overlay=document.getElementById('invadersFeaturedStage'),rank=document.getElementById('arcadeInvadersRank');
const title=document.getElementById('arcadeFeaturedName');
let display={},live={},uidNow='',canvas=null,info=null,lastPaint=0,activeSnapshot=null,drawLoop=0;
const safe=value=>{try{return JSON.parse(value||'{}')}catch{return {}}};
function warning(msg){if(rank)rank.textContent=msg;console.warn('TRASA INVADERS:',msg);}
function renderRanking(value){
 if(!rank)return;rank.replaceChildren();
 const entries=Object.entries(value||{}).map(([uid,v])=>({uid,...v}))
   .filter(p=>p&&typeof p.name==='string'&&Number.isFinite(Number(p.score)))
   .sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,5);
 if(!entries.length){rank.textContent='Todavía no hay récords';return;}
 for(let i=0;i<entries.length;i++){
   const row=document.createElement('div');row.className='arcade-rank-row';
   const name=document.createElement('span'),points=document.createElement('strong');
   name.textContent=`${i+1}. ${String(entries[i].name).slice(0,18)}`;
   points.textContent=String(entries[i].score);row.append(name,points);rank.append(row);
 }
}
function hide(){
 main?.classList.remove('invaders-hide');
 document.getElementById('snakeFeaturedStage')?.classList.remove('invaders-hide');
 overlay?.classList.add('hidden');overlay?.setAttribute('aria-hidden','true');
 uidNow='';canvas=null;info=null;activeSnapshot=null;
 if(drawLoop)cancelAnimationFrame(drawLoop);drawLoop=0;
}
function frame(t){
 if(!canvas||!activeSnapshot)return;
 if(t-lastPaint>35){drawInvadersScene(canvas,activeSnapshot);lastPaint=t;}
 drawLoop=requestAnimationFrame(frame);
}
function show(player,uid){
 if(!overlay||!main)return;
 if(uidNow!==uid||!canvas){
   uidNow=uid;overlay.replaceChildren();info=document.createElement('div');info.className='arcade-stage-meta';
   canvas=document.createElement('canvas');canvas.width=INVADERS_WIDTH;canvas.height=INVADERS_HEIGHT;canvas.className='invaders-projection-canvas';
   overlay.append(info,canvas);lastPaint=0;
   if(drawLoop)cancelAnimationFrame(drawLoop);drawLoop=requestAnimationFrame(frame);
 }
 main.classList.add('invaders-hide');
 document.getElementById('snakeFeaturedStage')?.classList.add('invaders-hide');
 overlay.classList.remove('hidden');overlay.setAttribute('aria-hidden','false');
 activeSnapshot=safe(player.state);
 info.textContent=`${String(player.name).slice(0,18)} · ${player.score||0} PUNTOS · OLEADA ${activeSnapshot.wave||1}/5 · VIDAS ${activeSnapshot.lives??3}`;
 if(title)title.textContent=`${String(player.name).toUpperCase()} · TRASA INVADERS`;
}
function reconcile(){
 if(display.mode!=='arcade'){hide();return;}
 const now=Date.now();const active=Object.entries(live)
   .filter(([,p])=>p&&p.status==='playing'&&['memory','run','zona','snake','invaders'].includes(p.gameId)
     &&Number(p.updatedAt||0)>now-22000)
   .sort((a,b)=>Number(a[1].startedAt||0)-Number(b[1].startedAt||0));
 const chosen=active.find(([uid])=>uid===display.featuredUid)||active[0];
 if(chosen?.[1].gameId==='invaders')show(chosen[1],chosen[0]);else hide();
}
async function init(){
 if(!isFirebaseConfigured()){warning('Firebase no está configurado.');return;}
 try{
   const f=await loadFirebase();await f.authMod.signInAnonymously(f.auth);
   f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('display')),s=>{display=s.val()||{};reconcile();},e=>warning('Error leyendo pantalla: '+e.message));
   f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('arcade/live')),s=>{live=s.val()||{};reconcile();},e=>warning('No se puede leer arcade/live: '+e.message));
   f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('arcade/scores/invaders')),s=>renderRanking(s.val()),e=>warning('Firebase no permite leer TOP 5 de Invaders. Actualiza las reglas: '+e.message));
   setInterval(reconcile,3000);
 }catch(e){warning('Error iniciando retransmisión de Invaders: '+e.message);}
}
init();
