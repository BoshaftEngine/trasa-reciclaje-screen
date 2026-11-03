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
function legacyGtaQuantityFromImage(image,x,y,side){
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

/* TRASA Control V29: OCR local de caracteres blancos de GTA por componentes visuales.
 * La plantilla se adapta a variaciones de posición de los números.
 * Lee cantidades SIN compartir imágenes ni consumir servicios remotos.
 */
const CHAR_W=12, CHAR_H=16;
const CHAR_TEMPLATES=[{"d":"4","w":10,"h":13,"b":[60,60,124,124,252,220,924,1948,1948,1820,3100,4095,4094,4094,28,28]},{"d":"5","w":9,"h":13,"b":[2046,2047,1792,1792,1792,1792,2046,3999,3999,7,7,7,3847,3847,2047,510]},{"d":"1","w":6,"h":13,"b":[12,255,4095,4095,3903,63,63,63,63,63,63,63,63,63,63,63]},{"d":"1","w":6,"h":13,"b":[12,255,1023,1023,3855,15,15,15,15,15,15,15,15,15,15,15]},{"d":"9","w":9,"h":13,"b":[240,2040,3854,3854,3599,3591,3591,3855,3855,2047,503,7,3599,3599,3998,2040]},{"d":"x","w":8,"h":9,"b":[3615,3615,3868,3868,1848,504,504,480,480,504,504,2040,3868,3868,3615,3615]},{"d":"7","w":9,"h":13,"b":[2046,4095,15,15,14,14,24,24,24,112,112,224,224,224,384,1920]},{"d":"x","w":8,"h":9,"b":[3615,3615,3868,3868,2040,504,504,480,480,504,504,2040,3868,3868,3615,3615]},{"d":"1","w":6,"h":12,"b":[255,1023,1023,3903,63,63,63,63,63,63,63,63,63,63,63,63]},{"d":"1","w":6,"h":12,"b":[255,1023,1023,4095,15,15,15,15,15,15,15,15,15,15,15,15]},{"d":"3","w":9,"h":13,"b":[504,3998,3599,3599,15,14,254,126,126,15,7,3591,3855,3855,2046,240]},{"d":"x","w":8,"h":9,"b":[3615,3615,3868,3868,1852,504,504,480,480,504,504,2040,1852,1852,3615,3615]},{"d":"6","w":10,"h":13,"b":[252,990,1807,1807,1792,1904,4094,3982,3982,3855,1795,1807,1934,1934,1022,96]},{"d":"x","w":8,"h":9,"b":[3615,3615,3868,3868,1848,504,504,480,480,480,480,2040,1852,1852,3612,3612]},{"d":"8","w":10,"h":13,"b":[1020,1950,1806,1806,1806,1822,1020,1020,1020,1806,3855,3855,1806,1806,2046,224]},{"d":"x","w":7,"h":9,"b":[3591,3591,3591,3591,1020,1016,1016,504,504,504,504,1020,3999,3999,3591,3591]},{"d":"4","w":10,"h":12,"b":[60,60,60,124,252,220,220,924,1948,1820,1820,3902,4095,30,30,28]},{"d":"x","w":7,"h":9,"b":[3591,3591,3591,3591,924,1020,1020,504,504,504,504,1020,3999,3999,3591,3591]},{"d":"7","w":9,"h":12,"b":[4095,15,15,15,14,30,30,24,120,112,112,240,224,480,480,384]},{"d":"2","w":9,"h":12,"b":[2040,3870,3870,3598,14,14,14,30,120,240,240,480,1920,3968,3968,4095]},{"d":"x","w":8,"h":9,"b":[3591,3591,3868,3868,1852,504,504,480,480,504,504,2040,1820,1820,3615,3615]},{"d":"2","w":8,"h":13,"b":[2044,4095,3591,3591,3591,7,31,60,60,248,480,1984,3840,3840,4095,4095]},{"d":"0","w":10,"h":13,"b":[252,2046,1806,1806,3855,3843,3075,3075,3075,3843,3843,1807,1934,1934,1022,252]},{"d":"0","w":10,"h":13,"b":[252,1022,1934,1934,1807,1795,3843,3843,3843,3843,3843,1807,1934,1934,1022,252]},{"d":"x","w":8,"h":10,"b":[3591,3591,3868,1852,1852,504,480,480,480,480,2040,1852,1852,3868,3591,3591]},{"d":"1","w":6,"h":13,"b":[63,1023,4095,4095,15,15,15,15,15,15,15,15,15,15,15,15]},{"d":"5","w":9,"h":13,"b":[2046,2046,1792,1792,3840,3952,4094,1806,1806,7,7,1543,3855,3855,2046,504]},{"d":"x","w":8,"h":10,"b":[3591,3591,3871,1852,1852,504,504,504,504,504,504,1852,1852,3871,3591,3591]},{"d":"1","w":5,"h":13,"b":[127,1023,4095,4095,3103,31,31,31,31,31,31,31,31,31,31,31]},{"d":"2","w":8,"h":13,"b":[2044,4095,3591,3591,2055,7,31,60,60,248,480,1984,3840,3840,4095,4095]},{"d":"x","w":8,"h":10,"b":[3847,3847,1799,476,476,508,248,248,248,248,508,2012,2012,1799,3591,3591]},{"d":"5","w":9,"h":13,"b":[2047,2046,1792,1792,1792,3952,4094,1807,1807,7,7,1543,3855,3855,2046,504]},{"d":"1","w":6,"h":13,"b":[63,1023,4047,4047,783,15,15,15,15,15,15,15,15,15,15,15]},{"d":"1","w":5,"h":13,"b":[127,1023,3999,3999,3103,31,31,31,31,31,31,31,31,31,31,31]},{"d":"x","w":8,"h":10,"b":[3847,3847,1823,2012,2012,508,248,248,248,248,508,2012,2012,1823,3591,3591]}];
function normalizedTile(image,x,y,side){
  const canvas=document.createElement('canvas');canvas.width=REF;canvas.height=REF;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)return null;
  context.imageSmoothingEnabled=true;
  context.imageSmoothingQuality='high';
  const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
  const sw=Math.max(0,Math.min(side,iw-x));
  const sh=Math.max(0,Math.min(side,ih-y));
  if(!(sw>0&&sh>0))return null;
  context.drawImage(image,x,y,sw,sh,0,0,REF*sw/side,REF*sh/side);
  return context.getImageData(0,0,REF,REF);
}
function getWhiteMask(imageData, threshold){
  const {data,width,height}=imageData;
  const mask=new Uint8Array(width*height);
  for(let i=0,p=0;i<data.length;i+=4,p++){
    const r=data[i],g=data[i+1],b=data[i+2];
    const hi=Math.max(r,g,b),lo=Math.min(r,g,b);
    mask[p]=(lo>=threshold&&hi-lo<85)?1:0;
  }
  return mask;
}
function connectedGlyphs(imageData,threshold=155){
  const W=imageData.width,H=imageData.height;
  const mask=getWhiteMask(imageData,threshold),visited=new Uint8Array(mask.length),results=[];
  const queue=new Int32Array(mask.length);
  const minX=Math.max(0,Math.round(W*.26)),maxX=Math.min(W-1,Math.round(W*.99));
  const minY=Math.max(0,Math.round(H*.48)),maxY=Math.min(H-1,Math.round(H*.94));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const start=y*W+x;
    if(!mask[start]||visited[start])continue;
    let begin=0,end=1;queue[0]=start;visited[start]=1;
    let xlo=x,xhi=x,ylo=y,yhi=y,pixels=[];
    while(begin<end){
      const idx=queue[begin++],cy=(idx/W)|0,cx=idx-cy*W;
      pixels.push(idx);
      if(cx<xlo)xlo=cx;if(cx>xhi)xhi=cx;if(cy<ylo)ylo=cy;if(cy>yhi)yhi=cy;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(dx===0&&dy===0)continue;
        const nx=cx+dx,ny=cy+dy;
        if(nx<minX||nx>maxX||ny<minY||ny>maxY)continue;
        const ni=ny*W+nx;
        if(mask[ni]&&!visited[ni]){visited[ni]=1;queue[end++]=ni;}
      }
    }
    const w=xhi-xlo+1,h=yhi-ylo+1,area=pixels.length;
    if(w<3||w>17||h<8||h>21||area<14||area>160||yhi<Math.round(H*.67)||yhi>Math.round(H*.96))continue;
    const bits=new Uint8Array(w*h);
    for(const idx of pixels){const cy=(idx/W)|0,cx=idx-cy*W;bits[(cy-ylo)*w+(cx-xlo)]=1;}
    const rows=[];
    for(let yy=0;yy<CHAR_H;yy++){
      let row=0;const sy=Math.min(h-1,Math.floor((yy+.5)*h/CHAR_H));
      for(let xx=0;xx<CHAR_W;xx++){
        const sx=Math.min(w-1,Math.floor((xx+.5)*w/CHAR_W));
        row=(row<<1)|bits[sy*w+sx];
      }
      rows.push(row);
    }
    results.push({x:xlo,y:ylo,w,h,area,bottom:yhi+1,rows});
  }
  return results.sort((a,b)=>a.x-b.x);
}
function bitCount(v){let c=0;while(v){v&=(v-1);c++;}return c;}
function characterScore(glyph, template){
  let diff=0;
  for(let i=0;i<CHAR_H;i++)diff+=bitCount(glyph.rows[i]^template.b[i]);
  const ratioError=Math.abs((glyph.w/glyph.h)-(template.w/template.h));
  const heightError=Math.abs(glyph.h-template.h)/REF;
  return diff/(CHAR_W*CHAR_H)+ratioError*.12+heightError*.07;
}
function classifyGlyph(glyph){
  const scores=[];
  for(const template of CHAR_TEMPLATES){
    scores.push({d:template.d,score:characterScore(glyph,template)});
  }
  scores.sort((a,b)=>a.score-b.score);
  return {d:scores[0]?.d||'',score:scores[0]?.score??1,second:scores.find(s=>s.d!==scores[0]?.d)?.score??1};
}
function readConnected(imageData,threshold){
  const glyphs=connectedGlyphs(imageData,threshold);
  for(const g of glyphs){const c=classifyGlyph(g);Object.assign(g,c);}
  const attempts=[];
  // Leemos desde el símbolo más a la derecha; las cifras de la cantidad
  // terminan casi en el mismo borde, mientras que la x queda a su izquierda.
  for(let end=glyphs.length-1;end>=0;end--){
    const last=glyphs[end];
    if(!/^[0-9]$/.test(last.d)||last.score>.24||last.x+last.w<REF*.62)continue;
    // No tomar una cifra intermedia como si fuera la última.
    if(glyphs.slice(end+1).some(g=>g.x>=last.x+last.w-1 && g.x-(last.x+last.w)<=5 &&
      Math.abs(g.bottom-last.bottom)<=4 && /^[0-9]$/.test(g.d)&&g.score<.24))continue;
    const digits=[last];let cursor=end-1,prefix=false;
    while(cursor>=0&&digits.length<5){
      const prev=glyphs[cursor],next=digits[digits.length-1];
      const gap=next.x-(prev.x+prev.w),baseDiff=Math.abs(prev.bottom-last.bottom);
      if(gap < -2 || gap>5 || baseDiff>5)break;
      const looksLikeX=prev.d==='x'&&prev.score<.23 &&
        prev.h<=next.h-1 && prev.y>=Math.min(...digits.map(g=>g.y))+1;
      if(looksLikeX){prefix=true;break;}
      if(!/^[0-9]$/.test(prev.d)||prev.score>.245)break;
      digits.push(prev);cursor--;
    }
    const str=digits.slice().reverse().map(c=>c.d).join('');
    const quantity=Number(str);
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>9999||str.length>4)continue;
    const quality=digits.reduce((a,g)=>a+g.score,0)/digits.length;
    const right=last.x+last.w;
    const bottom=last.bottom;
    const shapeScore=quality+(prefix?0:.055)+Math.abs(right-REF*.84)*.001+
      Math.abs(bottom-REF*.8)*.001 + (digits.length<2?.003:0);
    attempts.push({quantity,text:str,prefix,confidence:Math.max(0,1-quality/.25),quality,shapeScore,threshold,characters:digits.length});
  }
  // En caso de varios candidatos, priorizamos la secuencia completa, con prefijo x.
  attempts.sort((a,b)=>Number(b.prefix)-Number(a.prefix)||b.characters-a.characters||a.shapeScore-b.shapeScore);
  return attempts[0]||null;
}
function recognizeConnected(imageData){
  const votes=[];
  for(const threshold of [125,155,185]){
    const candidate=readConnected(imageData,threshold);
    if(candidate)votes.push(candidate);
  }
  if(!votes.length)return null;
  const groups=new Map();
  for(const vote of votes){
    let group=groups.get(vote.quantity);
    if(!group){group={count:0,best:vote,total:0};groups.set(vote.quantity,group);}
    group.count++;group.total+=vote.shapeScore;
    if(vote.shapeScore<group.best.shapeScore)group.best=vote;
  }
  const group=[...groups.values()].sort((a,b)=>b.count-a.count||a.total/a.count-b.total/b.count)[0];
  const candidate=group.best;
  return {...candidate,votes:group.count,reliable:(group.count>=2&&candidate.quality<.22)||(candidate.prefix&&candidate.quality<.13),hint:candidate.prefix?'Número y prefijo x detectados':'Número detectado (sin prefijo visible)'};
}


/** Lee cantidades en capturas GTA usando dos métodos locales independientes.
 * Si los dos discrepan, prioriza el lector de caracteres con prefijo x completo
 * y marca el resultado para revisión manual. */
export function gtaQuantityFromImage(image,x,y,side){
  const sample=normalizedTile(image,x,y,side);
  if(!sample) return {quantity:null,reliable:false,confidence:0,hint:'Casilla fuera de imagen'};
  const connected=recognizeConnected(sample);
  const original=legacyGtaQuantityFromImage(image,x,y,side);
  const a=connected?.quantity, b=original?.quantity;
  if(a!=null && b!=null && a===b)
    return {quantity:a,reliable:connected.prefix||String(a).length>=2,confidence:connected.confidence,method:'Doble comprobación',hint:connected.prefix||String(a).length>=2?'Lectura confirmada por dos métodos':'Número sin prefijo · revisar'};
  if(a!=null && connected.prefix && connected.reliable && connected.votes>=2 && connected.quality<.17)
    return {quantity:a,reliable:true,confidence:connected.confidence,method:'Componentes',hint:b!=null&&a!==b?'Lectores distintos · revisa el número':'Lectura de caracteres completa'};
  if(b!=null && original.reliable && (!connected || !connected.prefix || connected.votes<2))
    return {quantity:b,reliable:true,confidence:original.confidence,method:'Patrones',hint:'Lectura por patrones · revisa el número'};
  if(a!=null)
    return {quantity:a,reliable:false,confidence:connected.confidence,method:'Componentes',hint:'Lectura aproximada · revisar'};
  if(b!=null)
    return {quantity:b,reliable:false,confidence:original.confidence,method:'Patrones',hint:'Lectura aproximada · revisar'};
  return {quantity:null,reliable:false,confidence:0,method:'Ninguno',hint:'No se detectan cifras. Revisa el recorte.'};
}
