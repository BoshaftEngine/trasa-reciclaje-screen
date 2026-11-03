/* TRASA V28: lectura local de xNNN por patrón visual, sin red ni OCR externo.
   Patrones de números obtenidos de la captura de inventario facilitada para el proyecto.
   No clasifica materiales: únicamente reconoce cantidades sobre la cuadrícula. */
const GLYPHS = {"0":[[10,120,508,398,903,903,771,771,771,903,903,390,510,252],[10,124,254,454,391,899,899,899,899,899,391,390,510,252]],"1":[[6,15,31,63,55,7,7,7,7,7,7,7,7,7],[6,7,31,63,51,7,7,7,7,7,7,7,7,7],[6,15,31,63,55,7,7,7,7,7,7,7,7,7],[6,15,31,63,55,7,7,7,7,7,7,7,7,7]],"2":[[9,124,254,199,451,3,7,14,28,56,112,224,511,511],[9,124,254,454,391,6,6,12,28,56,112,224,511,511],[9,124,254,455,391,7,6,14,28,56,112,224,511,511]],"3":[[9,124,254,455,391,7,62,60,14,3,387,391,510,252]],"4":[[10,14,30,62,62,110,238,206,398,910,1023,511,14,14],[11,1948,1980,828,1660,748,1228,396,908,780,2047,1022,12,12]],"5":[[9,510,510,384,384,400,508,462,7,7,263,390,510,252],[9,255,255,192,192,216,254,487,3,3,131,451,255,126],[9,255,255,192,192,472,510,463,3,3,131,455,254,124]],"6":[[10,120,254,390,902,784,1020,974,902,903,903,390,510,252]],"7":[[9,511,511,7,14,12,28,24,56,48,112,96,224,192],[9,511,511,3,6,14,12,28,24,56,48,112,96,224]],"8":[[10,124,254,455,391,390,254,124,462,391,899,391,510,252]],"9":[[10,124,510,454,391,899,391,463,255,51,391,390,510,252]]};

const REF=86;
function maskFromPixels(imageData, threshold){
  const {data,width,height}=imageData;
  const out=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    const lo=Math.min(r,g,b),hi=Math.max(r,g,b);
    out[y*width+x]=lo>threshold&&hi-lo<90?1:0;
  }
  return out;
}
function popcount(v){let c=0;while(v){v&=v-1;c++;}return c;}
function digitRead(imageData, threshold){
  const width=imageData.width,height=imageData.height;
  if(width<80||height<80)return null;
  const mask=maskFromPixels(imageData,threshold);
  // El número se encuentra en la esquina inferior derecha del hueco.
  // La línea base está alrededor del 80 % de la altura de cada casilla.
  let baseline=-1;
  for(let y=52;y<=71;y++)for(let x=55;x<=79;x++)if(mask[y*width+x])baseline=Math.max(baseline,y);
  if(baseline<65||baseline>70)return null;
  const projection=new Uint8Array(82);
  for(let x=21;x<=81;x++)for(let dy=0;dy<13;dy++){
    const y=baseline-12+dy;
    if(y>=0&&y<height)projection[x]+=mask[y*width+x];
  }
  let end=0;for(let x=45;x<=79;x++)if(projection[x]>0)end=x+1;
  if(!end)return null;
  const chars=[];
  let maxError=0,sumError=0;
  for(let k=0;k<4;k++){
    let best=null;
    for(let gap=0;gap<=3;gap++){
      const e=end-gap;
      if(e<=0||projection[e-1]===0)continue;
      for(const [digit,templates] of Object.entries(GLYPHS))for(const template of templates){
        const w=template[0],start=e-w;
        if(start<21)continue;
        let mismatches=0;
        for(let ry=0;ry<13;ry++){
          let row=0;const yy=baseline-12+ry;
          for(let cx=start;cx<e;cx++)row=(row<<1)|mask[yy*width+cx];
          mismatches+=popcount(row^template[ry+1]);
        }
        const error=mismatches/(13*w);
        const score=error+gap*.012;
        if(!best||score<best.score)best={digit,start,score,error};
      }
    }
    if(!best||best.score>.235)break;
    chars.push(best.digit);
    sumError+=best.score;
    maxError=Math.max(maxError,best.score);
    end=best.start;
    while(end>21&&projection[end-1]===0)end--;
    if(end<29)break;
  }
  if(!chars.length)return null;
  const text=chars.reverse().join(''),quantity=Number(text);
  if(!Number.isInteger(quantity)||quantity<1||quantity>9999)return null;
  return {quantity,text,confidence:Math.max(0,1-sumError/chars.length/.235),maxError,meanError:sumError/chars.length,threshold};
}
// API independiente que se puede probar sin cargar Firebase ni Tesseract.
export function recognizeGtaQuantity(imageData){
  const passes=[];
  for(const threshold of [155,125,185]){
    const result=digitRead(imageData,threshold);
    if(result)passes.push(result);
  }
  if(!passes.length)return {quantity:null,confidence:0,hint:'Cantidad no reconocida'};
  // Confianza adicional cuando varias binarizaciones coinciden.
  const grouped=new Map();
  for(const p of passes){const g=grouped.get(p.quantity)||{count:0,best:p};g.count++;if(p.meanError<g.best.meanError)g.best=p;grouped.set(p.quantity,g);}
  const ranked=[...grouped.values()].sort((a,b)=>b.count-a.count||a.best.meanError-b.best.meanError);
  const chosen=ranked[0];
  const high=chosen.count>=2&&chosen.best.maxError<=.20;
  return {...chosen.best,confidence:Math.min(1,chosen.best.confidence+(chosen.count-1)*.12),reliable:high||chosen.best.maxError<=.12,hint:high?'Lectura local comprobada':'Lectura local · revisar'};
}
export function gtaQuantityFromImage(image,x,y,side){
  const canvas=document.createElement('canvas');canvas.width=REF;canvas.height=REF;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return {quantity:null,confidence:0,hint:'No se puede leer el canvas'};
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const srcW=Math.max(0,Math.min(side,image.naturalWidth-x));
  const srcH=Math.max(0,Math.min(side,image.naturalHeight-y));
  if(!srcW||!srcH)return {quantity:null,confidence:0,hint:'Casilla fuera de imagen'};
  ctx.drawImage(image,x,y,srcW,srcH,0,0,REF*srcW/side,REF*srcH/side);
  return recognizeGtaQuantity(ctx.getImageData(0,0,REF,REF));
}
