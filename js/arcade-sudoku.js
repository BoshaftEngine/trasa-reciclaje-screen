/* TRASA SUDOKU V22: seis juegos compatibles, generador con solución única. */
export const SUDOKU_LEVELS=[{id:'facil',holes:37,base:1400},{id:'medio',holes:46,base:2400},{id:'dificil',holes:51,base:3800}];
const rows=Array.from({length:81},(_,i)=>Math.floor(i/9)),cols=Array.from({length:81},(_,i)=>i%9),boxes=Array.from({length:81},(_,i)=>Math.floor(rows[i]/3)*3+Math.floor(cols[i]/3));
const shuffle=(arr,r=Math.random)=>{const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function solution(r){const rr=shuffle([0,1,2],r).flatMap(g=>shuffle([0,1,2],r).map(i=>3*g+i)),cc=shuffle([0,1,2],r).flatMap(g=>shuffle([0,1,2],r).map(i=>3*g+i)),digits=shuffle([1,2,3,4,5,6,7,8,9],r);return rr.flatMap(x=>cc.map(y=>digits[(x*3+Math.floor(x/3)+y)%9]));}
export function countSudokuSolutions(grid,limit=2){if(!Array.isArray(grid)||grid.length!==81)return 0;const values=grid.slice(),rr=Array(9).fill(0),cc=Array(9).fill(0),bb=Array(9).fill(0);
 for(let i=0;i<81;i++)if(values[i]){const bit=1<<values[i];if((rr[rows[i]]&bit)||(cc[cols[i]]&bit)||(bb[boxes[i]]&bit))return 0;rr[rows[i]]|=bit;cc[cols[i]]|=bit;bb[boxes[i]]|=bit;}
 let solutions=0;function walk(){if(solutions>=limit)return;let best=-1,mask=0,few=10;for(let i=0;i<81;i++)if(!values[i]){let bits=(~(rr[rows[i]]|cc[cols[i]]|bb[boxes[i]]))&0x3fe,c=0;for(let b=bits;b;b&=b-1)c++;if(!c)return;if(c<few){best=i;few=c;mask=bits;if(c===1)break;}}if(best<0){solutions++;return;}for(let b=mask;b&&solutions<limit;b&=b-1){const bit=b&-b,n=Math.log2(bit)|0;values[best]=n;rr[rows[best]]|=bit;cc[cols[best]]|=bit;bb[boxes[best]]|=bit;walk();rr[rows[best]]^=bit;cc[cols[best]]^=bit;bb[boxes[best]]^=bit;values[best]=0;}}walk();return solutions;}
export function generateSudoku(level='medio',random=Math.random){const cfg=SUDOKU_LEVELS.find(x=>x.id===level)||SUDOKU_LEVELS[1];let best=null;for(let attempt=0;attempt<5;attempt++){const solved=solution(random),givens=solved.slice();let removed=0;for(const i of shuffle([...Array(81).keys()],random)){if(removed>=cfg.holes)break;const v=givens[i];givens[i]=0;if(countSudokuSolutions(givens)!==1)givens[i]=v;else removed++;}if(!best||removed>best.removed)best={givens,solved,removed};if(removed>=cfg.holes)break;}return best;}
export function createSudoku(difficulty='medio'){const p=generateSudoku(difficulty);return {difficulty,givens:p.givens,solution:p.solved,values:p.givens.slice(),notes:Array(81).fill(0),selected:0,noteMode:false,mistakes:0,hints:3,hintsUsed:0,elapsed:0,phase:'playing',score:0,notice:''};}
const countCorrect=g=>g.values.reduce((n,v,i)=>n+Number(v===g.solution[i]),0);
function checkWin(g){if(countCorrect(g)===81){g.phase='won';const base=SUDOKU_LEVELS.find(l=>l.id===g.difficulty)?.base||2400;g.score=Math.max(100,base+(81-g.givens.filter(Boolean).length)*12-Math.floor(g.elapsed)*2-g.mistakes*150-g.hintsUsed*200);}}
export function selectSudoku(g,i){if(g?.phase!=='playing'||!Number.isInteger(i)||i<0||i>=81)return;g.selected=i;}
export function toggleSudokuNotes(g){if(g?.phase==='playing')g.noteMode=!g.noteMode;}
export function enterSudoku(g,n){if(g?.phase!=='playing'||!Number.isInteger(n)||n<0||n>9)return;const i=g.selected;if(g.givens[i])return;if(g.noteMode&&n){g.notes[i]^=1<<n;return;}if(g.values[i]===n)return;g.values[i]=n;g.notes[i]=0;if(n&&n!==g.solution[i]){g.mistakes++;g.notice=`ERROR ${g.mistakes}/3`;if(g.mistakes>=3)g.phase='lost';}else if(n)checkWin(g);}
export function hintSudoku(g){if(g?.phase!=='playing'||!g.hints)return;let i=g.selected;if(g.givens[i]||g.values[i]===g.solution[i])i=g.values.findIndex((v,j)=>!g.givens[j]&&v!==g.solution[j]);if(i<0)return;g.selected=i;g.values[i]=g.solution[i];g.notes[i]=0;g.hints--;g.hintsUsed++;checkWin(g);}
export function stepSudoku(g,dt){if(g?.phase==='playing')g.elapsed+=Math.max(0,Math.min(.1,dt||0));}
export function packSudokuState(g){return {givens:g.givens,values:g.values,notes:g.notes,wrong:g.values.map((v,i)=>v&&!g.givens[i]&&v!==g.solution[i]?i:-1).filter(x=>x>=0),selected:g.selected,difficulty:g.difficulty,mistakes:g.mistakes,hints:g.hints,elapsed:+g.elapsed.toFixed(1),phase:g.phase,score:g.score,noteMode:g.noteMode,filled:countCorrect(g)};}
// Cantidad colocada de cada cifra (incluyendo números dados y escritos).
// Nueve apariciones = cifra completa; si borras una, vuelve al teclado.
export function sudokuDigitCounts(values){
 const counts=Array(10).fill(0);
 for(const value of values||[])if(Number.isInteger(value)&&value>=1&&value<=9)counts[value]++;
 return counts;
}
export function sudokuSelectedDigit(state){
 const i=Number(state?.selected);
 return Number.isInteger(i)&&i>=0&&i<81 ? (state.values?.[i]||0) : 0;
}
export function formatSudokuTime(t){const s=Math.max(0,Math.floor(t||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
const imageCache={};function texture(name){if(typeof Image==='undefined')return null;if(!imageCache[name]){const x=new Image(),o={image:x,ready:false};imageCache[name]=o;x.onload=()=>o.ready=true;x.onerror=()=>o.ready=false;x.src=`assets/trasa-sudoku/${name}.png?v=22`;}return imageCache[name].ready?imageCache[name].image:null;}
export function drawSudokuScene(canvas,s){const ctx=canvas.getContext('2d');if(!ctx)return;const O=26,C=54;ctx.clearRect(0,0,540,540);ctx.fillStyle='#19291d';ctx.fillRect(0,0,540,540);const selected=s.selected??-1,sr=Math.floor(selected/9),sc=selected%9,sb=Math.floor(sr/3)*3+Math.floor(sc/3);
 const chosenDigit=sudokuSelectedDigit(s);
 for(let i=0;i<81;i++){const r=Math.floor(i/9),c=i%9,x=O+c*C,y=O+r*C,b=Math.floor(r/3)*3+Math.floor(c/3),isSel=i===selected;ctx.fillStyle=isSel?'#bfd8a9':(r+c)%2?'#e0e9d8':'#f1f3e8';ctx.fillRect(x,y,C,C);const img=texture(isSel?'casilla-seleccionada':(r+c)%2?'casilla-oscura':'casilla-clara');if(img)ctx.drawImage(img,x,y,C,C);if(!isSel&&(r===sr||c===sc||b===sb)){ctx.fillStyle='rgba(148,187,104,.20)';ctx.fillRect(x,y,C,C);}
  // Resalta TODAS las apariciones del número seleccionado, incluidas las
  // cifras originales. Este sombreado se ve también desde la pantalla GTA.
  if(chosenDigit&&s.values[i]===chosenDigit){ctx.fillStyle=isSel?'rgba(95,148,66,.35)':'rgba(109,181,89,.46)';ctx.fillRect(x,y,C,C);}
  if(isSel){ctx.strokeStyle='#397b40';ctx.lineWidth=3;ctx.strokeRect(x+2,y+2,C-4,C-4);}
  if(s.wrong?.includes(i)){ctx.fillStyle='rgba(233,105,89,.28)';ctx.fillRect(x,y,C,C);}
  if(s.values[i]){ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=(s.givens[i]?'bold ':'')+'29px Arial';ctx.fillStyle=s.wrong?.includes(i)?'#a1352d':s.givens[i]?'#1e3929':'#427345';ctx.fillText(String(s.values[i]),x+27,y+29);}else if(s.notes?.[i]){ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='13px Arial';ctx.fillStyle='#61835e';for(let n=1;n<=9;n++)if(s.notes[i]&(1<<n))ctx.fillText(String(n),x+(n-1)%3*17+11,y+Math.floor((n-1)/3)*17+11);}}
 ctx.strokeStyle='#415842';for(let n=0;n<=9;n++){ctx.lineWidth=n%3===0?4:1;const q=O+n*C;ctx.beginPath();ctx.moveTo(O,q);ctx.lineTo(O+9*C,q);ctx.moveTo(q,O);ctx.lineTo(q,O+9*C);ctx.stroke();}
 if(s.phase==='won'||s.phase==='lost'){ctx.fillStyle='rgba(12,28,17,.83)';ctx.fillRect(O,O,486,486);ctx.textAlign='center';ctx.fillStyle='#f1f7e7';ctx.font='bold 30px Arial';ctx.fillText(s.phase==='won'?'¡SUDOKU COMPLETADO!':'FIN DE PARTIDA',270,245);ctx.font='bold 23px Arial';ctx.fillText(s.phase==='won'?`${s.score} PUNTOS`:'3 ERRORES',270,290);}}
