/* Controles compartidos para móvil, escritorio y página de prueba. */
export function mountZonaInput(root,canvas,onShoot,onInteract,onMap){
  const pressed=new Set();let lookDelta=0,lastX=null,lookId=null;
  const panel=document.createElement('div');panel.className='zona-controls';
  panel.innerHTML=`<div class="zona-move"><button data-zona="turnLeft" aria-label="Girar izquierda">↶</button><button data-zona="forward" aria-label="Avanzar">▲</button><button data-zona="backward" aria-label="Retroceder">▼</button><button data-zona="turnRight" aria-label="Girar derecha">↷</button></div><div class="zona-buttons"><button data-zona="shoot" class="zona-fire">⚡ DISPARAR</button><button data-zona="interact">✋ USAR</button><button data-zona="map">▦ MAPA</button></div>`;
  root.append(panel);
  const pressMap={forward:'forward',backward:'backward',turnLeft:'turnLeft',turnRight:'turnRight'};
  for(const btn of panel.querySelectorAll('button')){
    const id=btn.dataset.zona;
    if(pressMap[id]){
      btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);pressed.add(id);});
      const release=()=>pressed.delete(id);
      for(const name of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(name,release);
    }else btn.addEventListener('click',()=>{if(id==='shoot')onShoot();else if(id==='interact')onInteract();else onMap();});
  }
  const codeMap={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',KeyD:'right',ArrowLeft:'turnLeft',ArrowRight:'turnRight',KeyQ:'turnLeft',KeyE:'interact',KeyM:'map',Space:'shoot'};
  const keydown=e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;const code=codeMap[e.code];if(!code)return;e.preventDefault();if(!e.repeat&&code==='shoot')onShoot();else if(!e.repeat&&code==='interact')onInteract();else if(!e.repeat&&code==='map')onMap();else pressed.add(code);};
  const keyup=e=>{const code=codeMap[e.code];if(code)pressed.delete(code);};
  const blur=()=>pressed.clear();
  const pointerDown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();lookId=e.pointerId;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);};
  const pointerMove=e=>{if(lookId!==e.pointerId)return;const dx=e.clientX-lastX;lastX=e.clientX;lookDelta+=dx*.006;};
  const pointerUp=e=>{if(lookId===e.pointerId){lookId=null;lastX=null;}};
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,pointerUp);
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
  return {read(){const value={forward:Number(pressed.has('forward'))-Number(pressed.has('backward')),side:Number(pressed.has('right'))-Number(pressed.has('left')),turn:Number(pressed.has('turnRight'))-Number(pressed.has('turnLeft')),lookDelta};lookDelta=0;return value;},
    destroy(){pressed.clear();panel.remove();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.removeEventListener(name,pointerUp);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);}};
}
