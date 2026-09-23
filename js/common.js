import { firebaseConfig, ROOM_ID } from "./firebase-config.js";
const V="12.19.0";
export function roomPath(c=""){return `rooms/${ROOM_ID}${c?"/"+c:""}`;}
export function isFirebaseConfigured(){return [firebaseConfig.apiKey,firebaseConfig.authDomain,firebaseConfig.databaseURL,firebaseConfig.projectId,firebaseConfig.appId].every(v=>typeof v==="string"&&v.length>5&&!v.includes("PEGA_AQUI")&&!v.includes("TU-PROYECTO"));}
export async function loadFirebase(){const appMod=await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);const dbMod=await import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`);const authMod=await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);const app=appMod.initializeApp(firebaseConfig);return {app,db:dbMod.getDatabase(app),auth:authMod.getAuth(app),dbMod,authMod};}
