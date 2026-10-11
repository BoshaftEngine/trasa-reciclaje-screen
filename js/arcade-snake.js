/* TRASA SNAKE · V15 - sprites editables.
   Sustituye los PNG de assets/trasa-snake conservando los nombres.
   El juego sigue funcionando con dibujos de respaldo si falta una imagen.
*/
export const SNAKE_COLS = 18;
export const SNAKE_ROWS = 18;
export const SNAKE_CANVAS = 576;
const CELL = 28;
const OFFSET = 36;
const VECTORS = [[0,-1],[1,0],[0,1],[-1,0]];
const inBounds = ([x,y])=>x>=0&&y>=0&&x<SNAKE_COLS&&y<SNAKE_ROWS;
const equal=(a,b)=>!!a&&!!b&&a[0]===b[0]&&a[1]===b[1];
const occupied=(cell,cells)=>cells.some(c=>equal(c,cell));
const rngIndex=(random,len)=>Math.min(len-1,Math.floor(Math.max(0,Math.min(.999999,Number(random())||0))*len));
function chooseCell(game,random,minHeadDist=0){
  const taken=[...game.body,...game.hazards,game.food,game.bonus?.cell].filter(Boolean);
  const possible=[];
  for(let y=0;y<SNAKE_ROWS;y++)for(let x=0;x<SNAKE_COLS;x++){
    const c=[x,y];
    if(occupied(c,taken))continue;
    if(Math.abs(game.body[0][0]-x)+Math.abs(game.body[0][1]-y)<minHeadDist)continue;
    possible.push(c);
  }
  return possible.length?possible[rngIndex(random,possible.length)]:null;
}
export function createSnake(random=Math.random){
  const game={body:[[8,9],[7,9],[6,9],[5,9]],dir:1,nextDir:1,food:null,foodType:0,
    bonus:null,hazards:[],foods:0,score:0,elapsed:0,countdown:3.1,accum:0,
    lost:false,won:false,reason:'',tick:0};
  game.food=chooseCell(game,random,4);
  return game;
}
export function turnSnake(game,dir){
  if(!game||game.lost||game.won||!Number.isInteger(dir)||dir<0||dir>3)return false;
  if(game.nextDir!==game.dir||dir===game.dir||(dir+2)%4===game.dir)return false;
  game.nextDir=dir;return true;
}
export function snakeSpeed(game){return Math.max(92,210-(Number(game.foods)||0)*7);}
function addHazards(game,random){
  const amount=game.foods>=12?2:1;
  for(let i=0;i<amount&&game.hazards.length<14;i++){
    const pos=chooseCell(game,random,4);
    if(pos)game.hazards.push(pos);
  }
}
function snakeTick(game,random){
  game.dir=game.nextDir;
  const vec=VECTORS[game.dir];
  const head=[game.body[0][0]+vec[0],game.body[0][1]+vec[1]];
  const eating=equal(head,game.food);
  const bonus=game.bonus&&equal(head,game.bonus.cell);
  const collideBody=eating?game.body:game.body.slice(0,-1);
  if(!inBounds(head)||occupied(head,collideBody)||occupied(head,game.hazards)){
    game.lost=true;
    game.reason=!inBounds(head)?'Has chocado con el límite':occupied(head,game.hazards)?'Has tocado residuos tóxicos':'Has chocado contigo mismo';
    return;
  }
  game.body.unshift(head);if(!eating)game.body.pop();
  if(eating){
    game.foods++;game.score+=10;game.food=null;
    game.foodType=(game.foodType+1)%5;
    if(game.foods%4===0)addHazards(game,random);
    if(game.foods%5===0&&!game.bonus){const cell=chooseCell(game,random,3);if(cell)game.bonus={cell,ttl:7};}
    game.food=chooseCell(game,random,2);
    if(!game.food){game.won=true;game.reason='¡Planta completamente reciclada!';}
  }
  if(bonus){game.score+=35;game.bonus=null;}
  game.tick++;
}
export function stepSnake(game,dt,random=Math.random){
  if(!game||game.lost||game.won)return;
  dt=Math.max(0,Math.min(.09,Number(dt)||0));
  if(game.countdown>0){game.countdown=Math.max(0,game.countdown-dt);return;}
  game.elapsed+=dt;
  if(game.bonus){game.bonus.ttl-=dt;if(game.bonus.ttl<=0)game.bonus=null;}
  game.accum+=dt*1000;
  const ms=snakeSpeed(game);
  if(game.accum>=ms){game.accum=Math.min(game.accum-ms,ms);snakeTick(game,random);}
}
export function packSnakeState(game){
  return{body:game.body,dir:game.dir,food:game.food,foodType:game.foodType,
    bonus:game.bonus?{cell:game.bonus.cell,ttl:+game.bonus.ttl.toFixed(1)}:null,
    hazards:game.hazards,foods:game.foods,score:game.score,
    elapsed:+game.elapsed.toFixed(1),countdown:+game.countdown.toFixed(1),
    lost:game.lost,won:game.won,reason:game.reason,tick:game.tick};
}

// =========================================================
// ASSETS EDITABLES - PNG con fondo transparente salvo casillas.
// =========================================================
export const SNAKE_ASSETS={
  head:'assets/trasa-snake/serpiente-cabeza.png',
  body:'assets/trasa-snake/serpiente-cuerpo.png',
  curve:'assets/trasa-snake/serpiente-curva.png',
  tail:'assets/trasa-snake/serpiente-cola.png',
  food0:'assets/trasa-snake/material-acero.png',
  food1:'assets/trasa-snake/material-aluminio.png',
  food2:'assets/trasa-snake/material-madera.png',
  food3:'assets/trasa-snake/material-caucho.png',
  food4:'assets/trasa-snake/material-plastico.png',
  bonus:'assets/trasa-snake/bonus.png',
  toxic:'assets/trasa-snake/residuo-toxico.png',
  tileLight:'assets/trasa-snake/casilla-clara.png',
  tileDark:'assets/trasa-snake/casilla-oscura.png'
};
const images={};
if(typeof Image!=='undefined'){
  for(const [key,path] of Object.entries(SNAKE_ASSETS)){
    const img=new Image();
    img.onload=()=>{images[key]=img;};
    img.onerror=()=>{delete images[key];};
    img.src=path+'?v=18';
  }
}
function rounded(ctx,x,y,w,h,r,fill){
  ctx.fillStyle=fill;ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);
  ctx.fill();
}
function fillSprite(ctx,key,x,y,size=CELL,angle=0){
  const img=images[key];if(!img||!img.naturalWidth||!img.naturalHeight)return false;
  // Contenedor cuadrado, conserva proporción de imagen incluso al reemplazar PNG.
  const scale=Math.min(size/img.naturalWidth,size/img.naturalHeight);
  const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.translate(x+size/2,y+size/2);ctx.rotate(angle);
  ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();
  return true;
}
function block(ctx,cell,color,scale=.85){
  const x=OFFSET+cell[0]*CELL,y=OFFSET+cell[1]*CELL;
  const gap=CELL*(1-scale)/2;
  rounded(ctx,x+gap,y+gap,CELL-2*gap,CELL-2*gap,4,color);
}
function spriteCell(ctx,key,pos,size=CELL,angle=0){
  const x=OFFSET+pos[0]*CELL+(CELL-size)/2;
  const y=OFFSET+pos[1]*CELL+(CELL-size)/2;
  return fillSprite(ctx,key,x,y,size,angle);
}
// Sprite base: cabeza y cola mirando a la DERECHA.
// Sprite base de curva conecta DERECHA y ABAJO.
function directionRotation(dir){return ((dir-1+4)%4)*Math.PI/2;}
function curveRotation(prev,cur,next){
  if(!prev||!next)return 0;
  const connected=[[prev[0]-cur[0],prev[1]-cur[1]],[next[0]-cur[0],next[1]-cur[1]]];
  const corners=[[[1,0],[0,1]],[[0,1],[-1,0]],[[-1,0],[0,-1]],[[0,-1],[1,0]]];
  for(let r=0;r<4;r++)if(corners[r].every(d=>connected.some(p=>p[0]===d[0]&&p[1]===d[1])))return r*Math.PI/2;
  return 0;
}
export function drawSnakeScene(canvas,state={}){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const t=Number(state.elapsed)||0,body=state.body||[],hazards=state.hazards||[];
  ctx.clearRect(0,0,SNAKE_CANVAS,SNAKE_CANVAS);
  ctx.fillStyle='#101a13';ctx.fillRect(0,0,SNAKE_CANVAS,SNAKE_CANVAS);
  rounded(ctx,13,13,550,550,15,'#263a2b');
  rounded(ctx,OFFSET-5,OFFSET-5,SNAKE_COLS*CELL+10,SNAKE_ROWS*CELL+10,9,'#111d16');
  for(let y=0;y<SNAKE_ROWS;y++)for(let x=0;x<SNAKE_COLS;x++){
    const color=(x+y)%2===0?'#213827':'#1c3021';
    if(!spriteCell(ctx,(x+y)%2===0?'tileLight':'tileDark',[x,y])){
      ctx.fillStyle=color;ctx.fillRect(OFFSET+x*CELL,OFFSET+y*CELL,CELL-1,CELL-1);
    }
  }
  for(const pos of hazards){
    if(!spriteCell(ctx,'toxic',pos,CELL)){
      block(ctx,pos,'#9f6a44',.83);
      const x=OFFSET+pos[0]*CELL,y=OFFSET+pos[1]*CELL;
      ctx.strokeStyle='#1f251a';ctx.lineWidth=4;ctx.beginPath();
      ctx.moveTo(x+9,y+9);ctx.lineTo(x+19,y+19);
      ctx.moveTo(x+19,y+9);ctx.lineTo(x+9,y+19);ctx.stroke();
    }
  }
  if(state.food){
    const c=state.food,variant=Number(state.foodType||0)%5;
    if(!spriteCell(ctx,'food'+variant,c,CELL)){
      block(ctx,c,['#71bdae','#e0bf6e','#9cbbd1','#b6cc79','#c1a1d3'][variant],.85);
      const x=OFFSET+(c[0]+.5)*CELL,y=OFFSET+(c[1]+.5)*CELL;
      ctx.fillStyle='#173220';ctx.font='bold 17px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♻',x,y+1);
    }
  }
  if(state.bonus?.cell){
    const pos=state.bonus.cell,pulse=.84+Math.sin(t*6)*.08;
    if(!spriteCell(ctx,'bonus',pos,CELL*pulse)){
      block(ctx,pos,'#d8d48a',pulse);
      ctx.fillStyle='#4a501f';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 17px Arial';
      ctx.fillText('★',OFFSET+(pos[0]+.5)*CELL,OFFSET+(pos[1]+.5)*CELL);
    }
  }
  for(let i=body.length-1;i>=0;i--){
    const p=body[i],prev=body[i-1],next=body[i+1];
    let key='body',angle=0;
    if(i===0){key='head';angle=directionRotation(Number(state.dir)||0);}
    else if(i===body.length-1){
      key='tail';const v=[p[0]-prev[0],p[1]-prev[1]];
      if(v[0]>0)angle=0;else if(v[0]<0)angle=Math.PI;else if(v[1]>0)angle=Math.PI/2;else angle=-Math.PI/2;
    }else{
      const dx=prev?.[0]-p[0],dy=prev?.[1]-p[1];
      const ex=next?.[0]-p[0],ey=next?.[1]-p[1];
      if((dx!==0&&ex!==0)||(dy!==0&&ey!==0)){key='body';angle=dy!==0?Math.PI/2:0;}
      else {key='curve';angle=curveRotation(prev,p,next);}
    }
    if(!spriteCell(ctx,key,p,CELL,angle)){
      block(ctx,p,i===0?'#a7d58e':i%2?'#426a41':'#567f4c',i===0?.92:.89);
      if(i===0){
        const x=OFFSET+p[0]*CELL,y=OFFSET+p[1]*CELL,side=Number(state.dir)||0;
        const eyes=side===1?[[19,9],[19,19]]:side===3?[[9,9],[9,19]]:side===0?[[9,9],[19,9]]:[[9,19],[19,19]];
        ctx.fillStyle='#1b321b';for(const [ex,ey] of eyes)ctx.fillRect(x+ex-2,y+ey-2,4,4);
      }
    }
  }
  ctx.font='bold 14px Arial';ctx.textBaseline='middle';ctx.fillStyle='#eff4cc';ctx.textAlign='left';
  ctx.fillText('TRASA SNAKE',37,20);ctx.textAlign='right';
  ctx.fillText(`${state.score||0} PT · ♻ ${state.foods||0}`,538,20);
  ctx.fillStyle='#a7b8a5';ctx.font='12px Arial';ctx.textAlign='left';
  ctx.fillText('RECOGE MATERIALES · EVITA RESIDUOS',39,556);
  if(Number(state.countdown)>0){
    ctx.fillStyle='rgba(5,17,10,.75)';ctx.fillRect(OFFSET,OFFSET,CELL*SNAKE_COLS,CELL*SNAKE_ROWS);
    rounded(ctx,185,215,206,143,12,'#354b34');ctx.textAlign='center';ctx.fillStyle='#ebf4d8';
    ctx.font='bold 25px Arial';ctx.fillText('PREPÁRATE',288,248);
    ctx.font='bold 67px Arial';ctx.fillText(String(Math.ceil(state.countdown)),288,311);
  }
  if(state.lost||state.won){
    ctx.fillStyle='rgba(6,17,11,.77)';ctx.fillRect(OFFSET,OFFSET,CELL*SNAKE_COLS,CELL*SNAKE_ROWS);
    rounded(ctx,114,198,348,165,12,'#344e35');ctx.fillStyle='#f0f7da';ctx.textAlign='center';
    ctx.font='bold 29px Arial';ctx.fillText(state.won?'¡RECICLAJE COMPLETO!':'FIN DE PARTIDA',288,249);
    ctx.font='bold 21px Arial';ctx.fillText(`${state.score||0} PUNTOS`,288,290);
    ctx.font='15px Arial';ctx.fillText(String(state.reason||'').slice(0,38),288,324);
  }
}
