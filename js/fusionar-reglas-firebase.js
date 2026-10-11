/** TRASA Arcade V16 — actualiza únicamente las reglas de Snake, conservando las existentes. */
const $ = id => document.getElementById(id);
function clone(value){return JSON.parse(JSON.stringify(value));}
function rewriteLegacyGameCondition(input, from, to){
  // Reemplazo puntual en una validación específica para cada juego.
  if(typeof input === 'string'){
    return input.replaceAll(`'${from}'`,`'${to}'`).replaceAll(`"${from}"`,`"${to}"`);
  }
  if(Array.isArray(input))return input.map(x=>rewriteLegacyGameCondition(x,from,to));
  if(input && typeof input==='object'){
    for(const k of Object.keys(input))input[k]=rewriteLegacyGameCondition(input[k],from,to);
  }
  return input;
}
export function mergeSnakeRules(original){
  if(!original || typeof original!=='object' || !original.rules?.rooms?.trasa?.arcade){
    throw Error('No encuentro rules → rooms → trasa → arcade. Debes usar las reglas ACTUALES de Firebase que ya permiten los tres juegos.');
  }
  const updated=clone(original);const arcade=updated.rules.rooms.trasa.arcade;
  const live=arcade.live?.$uid;
  if(!live || typeof live['.validate']!=='string')throw Error('No encuentro la validación arcade/live/$uid/.validate; no puedo ampliarla automáticamente sin cambiar la seguridad.');
  if(!/['"]snake['"]/.test(live['.validate'])){
    const expr="newData.child('gameId').val() === 'snake'";
    const pattern=/newData\.child\(['"]gameId['"]\)\.val\(\)\s*(?:===|==)\s*['"]zona['"]/;
    if(!pattern.test(live['.validate']))throw Error('No encuentro el permiso actual para zona en live/$uid. Revisa que hayas copiado todas las reglas vigentes.');
    live['.validate']=live['.validate'].replace(pattern,m=>`(${m} || ${expr})`);
  }
  for(const route of ['scores','history']){
    if(!arcade[route] || typeof arcade[route]!=='object')throw Error(`Falta arcade/${route} en las reglas actuales.`);
    if(!arcade[route].snake){
      if(!arcade[route].run)throw Error(`No encuentro arcade/${route}/run para copiar sus permisos y validaciones.`);
      arcade[route].snake=rewriteLegacyGameCondition(clone(arcade[route].run),'run','snake');
    }
  }
  return updated;
}
const source=$('firebaseRulesSource'),out=$('firebaseRulesOutput'),note=$('firebaseRulesNotice');
$('firebaseRulesMerge').onclick=()=>{
  try{const data=JSON.parse(source.value);const result=mergeSnakeRules(data);
    out.value=JSON.stringify(result,null,2);note.textContent='Reglas preparadas. Se han mantenido las rutas anteriores; comprueba y publica el resultado en Firebase.';note.className='ok';}
  catch(e){out.value='';note.textContent=`No se han generado reglas: ${e.message}`;note.className='error';}
};
$('firebaseRulesCopy').onclick=async()=>{
  if(!out.value){note.textContent='Primero prepara las reglas.';return;}
  try{await navigator.clipboard.writeText(out.value);note.textContent='Copiadas: vuelve a Firebase → Realtime Database → Rules, pega y pulsa Publicar.';}
  catch{out.focus();out.select();note.textContent='Seleccionadas. Pulsa Ctrl+C para copiar las reglas.';}
};
