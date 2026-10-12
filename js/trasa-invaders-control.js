/* V19: completa el selector de jugadores y la moderación con el quinto juego.
   No modifica control.js ni las herramientas originales de reciclaje. */
import {loadFirebase,roomPath,isFirebaseConfigured} from './common.js';
const $=id=>document.getElementById(id);
const games=['memory','run','zona','snake','invaders'];
let participants=new Map(),live={},scores={},history={};
function addOption(select,uid,label){if(!select||!uid)return;
 if([...select.options].some(o=>o.value===uid))return;
 select.add(new Option(label,uid));
}
function refresh(){
 const featured=$('arcadeFeaturedPlayer'),people=$('arcadeParticipantSelect'),now=Date.now();
 for(const [uid,p] of Object.entries(live))if(p?.gameId==='invaders'&&p.status==='playing'&&Number(p.updatedAt||0)>now-22000){
   addOption(featured,uid,`${p.name||'Jugador'} · Invaders · ${p.score||0} pt`);
   participants.set(uid,p.name||'Jugador');
 }
 for(const [uid,p] of Object.entries(scores))if(typeof p?.name==='string')participants.set(uid,p.name);
 for(const [uid,entries] of Object.entries(history))for(const result of Object.values(entries||{}))if(typeof result?.name==='string')participants.set(uid,result.name);
 for(const [uid,name] of participants)addOption(people,uid,`${name} · ${uid.slice(0,8)}…`);
}
async function init(){
 if(!isFirebaseConfigured())return;
 try{
   const f=await loadFirebase();await f.authMod.signInAnonymously(f.auth);
   const root=f.dbMod.ref(f.db,roomPath('arcade'));
   f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('arcade/live')),s=>{live=s.val()||{};refresh();});
   f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('arcade/scores/invaders')),s=>{scores=s.val()||{};refresh();});
   f.dbMod.onValue(f.dbMod.ref(f.db,roomPath('arcade/history/invaders')),s=>{history=s.val()||{};refresh();});
   // El listener CAPTURE impide ejecutar los borrados antiguos que desconocen Snake/Invaders.
   $('arcadeDeleteParticipant')?.addEventListener('click',async event=>{
     event.stopImmediatePropagation();event.preventDefault();
     const uid=$('arcadeParticipantSelect')?.value,feedback=$('arcadeAdminStatus');
     if(!uid){feedback.textContent='Selecciona un participante.';return;}
     const name=$('arcadeParticipantSelect')?.selectedOptions?.[0]?.textContent||'Jugador';
     if(!window.confirm(`¿Eliminar los récords de los cinco juegos y bloquear a ${name}?`))return;
     const nickname=name.split(' · ')[0];const changes={
       [`bans/${uid}`]:{name:nickname,blockedAt:f.dbMod.serverTimestamp()},[`live/${uid}`]:null
     };
     for(const game of games){changes[`scores/${game}/${uid}`]=null;changes[`history/${game}/${uid}`]=null;}
     changes[`scores/clasifica/${uid}`]=null;changes[`history/clasifica/${uid}`]=null;
     try{feedback.textContent='Eliminando…';await f.dbMod.update(root,changes);participants.delete(uid);feedback.textContent='Participante eliminado de los cinco juegos y bloqueado.';}
     catch(e){feedback.textContent='Firebase rechazó el borrado: '+e.message;}
   },true);
   $('arcadeClearAll')?.addEventListener('click',async event=>{
     event.stopImmediatePropagation();event.preventDefault();const feedback=$('arcadeAdminStatus');
     if(!window.confirm('¿BORRAR todos los resultados de los CINCO minijuegos?'))return;
     if(!window.confirm('Confirma el borrado GENERAL. Los bloqueos permanecerán.'))return;
     try{feedback.textContent='Borrando…';await f.dbMod.update(root,{live:null,scores:null,history:null,resetAt:f.dbMod.serverTimestamp()});participants.clear();feedback.textContent='Registros borrados. Bloqueos mantenidos.';}
     catch(e){feedback.textContent='Error al borrar: '+e.message;}
   },true);
 }catch(e){const info=$('arcadeAdminStatus');if(info)info.textContent='Control de Invaders: '+e.message;}
}
init();
