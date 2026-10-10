
/* Controles compartidos para móvil, escritorio y página de prueba.
   En PC: clic dentro del canvas => Pointer Lock. ESC lo libera. */
export function mountZonaInput(root,canvas,onShoot,onInteract,onMap){
  const pressed=new Set(); let lookDelta=0, touchLookId=null, touchLastX=0;
  const panel=document.createElement('div'); panel.className='zona-controls';
  panel.innerHTML=`<div class="zona-move"><button data-zona="turnLeft" aria-label="Girar izquierda">↶</button><button data-zona="forward" aria-label="Avanzar">▲</button><button data-zona="backward" aria-label="Retroceder">▼</button><button data-zona="turnRight" aria-label="Girar derecha">↷</button></div><div class="zona-buttons"><button data-zona="shoot" class="zona-fire">⚡ DISPARAR</button><button data-zona="interact">✋ USAR</button><button data-zona="map">▦ MAPA</button></div>`;
  root.append(panel);
  const pressMap={forward:'forward',backward:'backward',turnLeft:'turnLeft',turnRight:'turnRight'};
  for(const btn of panel.querySelectorAll('button')){
    const id=btn.dataset.zona;
    if(pressMap[id]){
      btn.addEventListener('pointerdown',e=>{e.preventDefault(); btn.setPointerCapture(e.pointerId); pressed.add(id);});
      const release=()=>pressed.delete(id);
      for(const n of ['pointerup','pointercancel','lostpointercapture']) btn.addEventListener(n,release);
    } else btn.addEventListener('click',()=>{ if(id==='shoot') onShoot(); else if(id==='interact') onInteract(); else onMap(); });
  }
  const codeMap={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',KeyD:'right',ArrowLeft:'turnLeft',ArrowRight:'turnRight',KeyQ:'turnLeft',KeyE:'interact',KeyM:'map',Space:'shoot'};
  const keydown=e=>{ if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return; const code=codeMap[e.code]; if(!code) return; e.preventDefault(); if(!e.repeat&&code==='shoot') onShoot(); else if(!e.repeat&&code==='interact') onInteract(); else if(!e.repeat&&code==='map') onMap(); else pressed.add(code); };
  const keyup=e=>{ const code=codeMap[e.code]; if(code) pressed.delete(code); };
  const blur=()=>pressed.clear();

  function mouseMove(e){ if(document.pointerLockElement!==canvas) return; lookDelta += e.movementX * 0.0038; }
  function canvasDown(e){
    if(e.pointerType==='mouse'){
      if(e.button!==0) return;
      e.preventDefault();
      if(document.pointerLockElement!==canvas) canvas.requestPointerLock?.();
      return;
    }
    // toque en móvil/tablet: giro arrastrando
    e.preventDefault(); touchLookId=e.pointerId; touchLastX=e.clientX; canvas.setPointerCapture(e.pointerId);
  }
  function canvasMove(e){
    if(e.pointerType==='mouse') return;
    if(touchLookId!==e.pointerId) return; const dx=e.clientX-touchLastX; touchLastX=e.clientX; lookDelta += dx*0.006;
  }
  function canvasUp(e){ if(touchLookId===e.pointerId){ touchLookId=null; touchLastX=0; } }

  document.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('pointerdown', canvasDown);
  canvas.addEventListener('pointermove', canvasMove);
  for(const n of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(n,canvasUp);
  window.addEventListener('keydown',keydown); window.addEventListener('keyup',keyup); window.addEventListener('blur',blur);
  return {
    read(){ const value={forward:Number(pressed.has('forward'))-Number(pressed.has('backward')), side:Number(pressed.has('right'))-Number(pressed.has('left')), turn:Number(pressed.has('turnRight'))-Number(pressed.has('turnLeft')), lookDelta}; lookDelta=0; return value; },
    destroy(){ pressed.clear(); panel.remove(); if(document.pointerLockElement===canvas) document.exitPointerLock?.(); document.removeEventListener('mousemove',mouseMove); canvas.removeEventListener('pointerdown',canvasDown); canvas.removeEventListener('pointermove',canvasMove); for(const n of ['pointerup','pointercancel','lostpointercapture']) canvas.removeEventListener(n,canvasUp); window.removeEventListener('keydown',keydown); window.removeEventListener('keyup',keyup); window.removeEventListener('blur',blur); }
  };
}
