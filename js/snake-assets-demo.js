import {createSnake,turnSnake,stepSnake,drawSnakeScene,packSnakeState} from './arcade-snake.js?v=15';
const canvas=document.getElementById('preview');const info=document.getElementById('info');
const dirs={ArrowUp:0,KeyW:0,ArrowRight:1,KeyD:1,ArrowDown:2,KeyS:2,ArrowLeft:3,KeyA:3};
let game=createSnake(),frame=0,last=0,touch=null;
window.addEventListener('keydown',event=>{if(dirs[event.code]===undefined)return;event.preventDefault();turnSnake(game,dirs[event.code]);});
for(const button of document.querySelectorAll('[data-dir]'))button.addEventListener('pointerdown',event=>{event.preventDefault();turnSnake(game,Number(button.dataset.dir));});
canvas.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse')return;event.preventDefault();touch={x:event.clientX,y:event.clientY,id:event.pointerId};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointerup',event=>{if(!touch||touch.id!==event.pointerId)return;const dx=event.clientX-touch.x,dy=event.clientY-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))>16)turnSnake(game,Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0));});
canvas.addEventListener('pointercancel',()=>{touch=null;});
function render(t){const dt=last?Math.min(.08,(t-last)/1000):0;last=t;stepSnake(game,dt);drawSnakeScene(canvas,packSnakeState(game));info.textContent=`${game.score} PUNTOS · ${game.foods} MATERIALES`;
  if(!game.won&&!game.lost)frame=requestAnimationFrame(render);
}
document.getElementById('restart').onclick=()=>{cancelAnimationFrame(frame);game=createSnake();last=0;frame=requestAnimationFrame(render);};
frame=requestAnimationFrame(render);
