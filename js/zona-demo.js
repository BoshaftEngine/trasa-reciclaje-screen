import {createZona,stepZona,shootZona,interactZona,drawZona,packZonaState} from './arcade-zona.js?v=1';
import {mountZonaInput} from './zona-input.js?v=1';
const canvas=document.getElementById('zonaDemoCanvas');const root=document.getElementById('zonaDemoRoot');const status=document.getElementById('zonaDemoStatus');
let game,input,last=0,frame;
function begin(){cancelAnimationFrame(frame);input?.destroy();game=createZona();input=mountZonaInput(root,canvas,()=>shootZona(game),()=>interactZona(game),()=>{game.showMap=!game.showMap;});last=0;frame=requestAnimationFrame(loop);}
function loop(t){const dt=last?Math.min(.05,(t-last)/1000):0;last=t;stepZona(game,dt,input.read());drawZona(canvas,packZonaState(game),{flash:game.flash>0});
  status.textContent=game.won?'MISIÓN COMPLETADA · Pulsa NUEVA PARTIDA para seguir.':game.lost?'FIN DE PARTIDA · Inténtalo de nuevo.':`MATERIALES ${game.materials}/4 · SALUD ${game.health}/3 · ${Math.ceil(game.remaining)} s · PUNTOS ${game.score}`;
  if(!game.won&&!game.lost)frame=requestAnimationFrame(loop);
}
document.getElementById('zonaDemoRestart').onclick=begin;begin();
