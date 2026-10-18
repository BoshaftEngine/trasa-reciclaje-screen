import {createInvaders,stepInvaders,drawInvadersScene,packInvadersState} from './arcade-invaders.js?v=20';
const canvas=document.getElementById('invadersDemoCanvas'),status=document.getElementById('invadersDemoInfo'),pad=document.getElementById('invadersDemoPad');
const held=new Set();let game=createInvaders(),frame=null,last=0;
const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'fire',ArrowUp:'fire',KeyW:'fire'};
window.addEventListener('keydown',e=>{if(keys[e.code]){e.preventDefault();held.add(keys[e.code]);}});
window.addEventListener('keyup',e=>{if(keys[e.code])held.delete(keys[e.code]);});window.addEventListener('blur',()=>held.clear());
for(const [key,title] of [['left','◀'],['fire','● DISPARAR'],['right','▶']]){
 const b=document.createElement('button');b.textContent=title;b.className='invaders-'+key;
 b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);held.add(key);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>held.delete(key));
 pad.append(b);
}
function tick(t){
 const dt=last?Math.min(.06,(t-last)/1000):0;last=t;
 stepInvaders(game,dt,{move:Number(held.has('right'))-Number(held.has('left')),shoot:held.has('fire')});
 drawInvadersScene(canvas,packInvadersState(game));
 status.textContent=`PUNTOS ${game.score} · OLEADA ${game.wave}/5 · VIDAS ${game.lives}`;
 if(['lost','won'].includes(game.phase)){frame=null;return;}frame=requestAnimationFrame(tick);
}
function begin(){if(frame!==null)cancelAnimationFrame(frame);game=createInvaders();last=0;held.clear();frame=requestAnimationFrame(tick);}
document.getElementById('invadersDemoRestart').onclick=begin;begin();
