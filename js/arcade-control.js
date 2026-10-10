import { loadFirebase, roomPath, isFirebaseConfigured } from "./common.js";
import { readLive, ARCADE_GAMES } from "./arcade-common.js?v=10";

const $ = id => document.getElementById(id);
const openBtn = $("openArcadeBtn");
const featuredSelect = $("arcadeFeaturedPlayer");
const featuredBtn = $("arcadeFeaturedBtn");
const arcadeStatus = $("arcadeControlStatus");
const userSelect = $("arcadeParticipantSelect");
const bannedSelect = $("arcadeBannedSelect");
const adminStatus = $("arcadeAdminStatus");
const delBtn = $("arcadeDeleteParticipant");
const clearAllBtn = $("arcadeClearAll");
const unbanBtn = $("arcadeUnbanParticipant");
const gameUrl = new URL("juego.html", document.baseURI).href;
const link = $("arcadeLink");
link.href = gameUrl;
link.textContent = gameUrl;
$("copyArcadeLink").onclick = async () => {
  try {
    await navigator.clipboard.writeText(gameUrl);
    arcadeStatus.textContent = "Enlace copiado.";
  } catch {
    arcadeStatus.textContent = "Copia el enlace que aparece debajo.";
  }
};

if (isFirebaseConfigured()) {
  try {
    const f = await loadFirebase();
    await f.authMod.signInAnonymously(f.auth);
    const displayRef = f.dbMod.ref(f.db, roomPath("display"));
    const liveRef = f.dbMod.ref(f.db, roomPath("arcade/live"));
    const arcadeRef = f.dbMod.ref(f.db, roomPath("arcade"));

    let display = {};
    let rawLive = {};
    let rawMemory = {};
    let rawRun = {};
    let rawZona = {};
    let rawHistoryMemory = {};
    let rawHistoryRun = {};
    let rawHistoryZona = {};
    let rawBans = {};
    let players = [];

    function fillSelect(select, entries, label) {
      const selected = select.value;
      select.replaceChildren(new Option(label, ""));
      for (const entry of entries) select.add(new Option(entry.label, entry.uid));
      select.value = entries.some(entry => entry.uid === selected) ? selected : "";
    }

    function buildParticipants() {
      const map = new Map();
      // Obtenemos participantes desde las partidas activas, récords e historial.
      const register = (uid, value) => {
        if (!value || typeof value.name !== "string") return;
        const prev = map.get(uid);
        const stamp = Number(value.updatedAt || value.finishedAt || value.startedAt || 0);
        if (!prev || stamp >= prev.stamp) map.set(uid, { uid, name: value.name, stamp });
      };
      for (const [uid, value] of Object.entries(rawLive)) register(uid, value);
      for (const [uid, value] of Object.entries(rawMemory)) register(uid, value);
      for (const [uid, value] of Object.entries(rawRun)) register(uid, value);
      for (const [uid, value] of Object.entries(rawZona)) register(uid, value);
      for (const history of [rawHistoryMemory, rawHistoryRun, rawHistoryZona]) {
        for (const [uid, entries] of Object.entries(history)) {
          for (const value of Object.values(entries || {})) register(uid, value);
        }
      }
      const list = [...map.values()].sort((a,b) => a.name.localeCompare(b.name, "es"));
      fillSelect(userSelect, list.map(p => ({uid:p.uid, label:`${p.name} · ${p.uid.slice(0, 8)}…`})), "Elige un participante");
      const blocked = Object.entries(rawBans).map(([uid,b]) => ({uid, label:`${b?.name || "Sin nombre"} · ${uid.slice(0,8)}…`}))
        .sort((a,b)=>a.label.localeCompare(b.label,"es"));
      fillSelect(bannedSelect, blocked, "Ninguna sesión bloqueada");
    }

    f.dbMod.onValue(displayRef, snap => {
      display = snap.val() || {};
      openBtn.textContent = display.mode === "arcade" ? "ARCADE ACTIVADO" : "ABRIR TRASA ARCADE";
      arcadeStatus.textContent = display.mode === "arcade"
        ? "Arcade está en pantalla. Puedes destacar un jugador."
        : "La pantalla no está en modo Arcade.";
      featuredSelect.value = display.featuredUid || "";
    });
    f.dbMod.onValue(liveRef, snap => {
      rawLive = snap.val() || {};
      players = readLive(rawLive);
      const selected = featuredSelect.value;
      featuredSelect.replaceChildren(new Option("Automático (primero en jugar)", ""));
      for (const p of players) {
        featuredSelect.add(new Option(`${p.name} · ${ARCADE_GAMES.find(g => g.id === p.gameId)?.short || p.gameId} · ${p.score} pt`, p.uid));
      }
      featuredSelect.value = [...featuredSelect.options].some(o => o.value === selected) ? selected : "";
      buildParticipants();
    });
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/scores/memory")), snap => {rawMemory = snap.val() || {}; buildParticipants();});
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/scores/run")), snap => {rawRun = snap.val() || {}; buildParticipants();});
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/scores/zona")), snap => {rawZona = snap.val() || {}; buildParticipants();});
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/history/memory")), snap => {rawHistoryMemory = snap.val() || {}; buildParticipants();});
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/history/run")), snap => {rawHistoryRun = snap.val() || {}; buildParticipants();});
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/history/zona")), snap => {rawHistoryZona = snap.val() || {}; buildParticipants();});
    f.dbMod.onValue(f.dbMod.ref(f.db, roomPath("arcade/bans")), snap => {rawBans = snap.val() || {}; buildParticipants();});

    openBtn.onclick = async () => {
      try {
        await f.dbMod.set(displayRef, {
          mode: "arcade", featuredUid: "", updatedAt: f.dbMod.serverTimestamp()
        });
      } catch (error) { arcadeStatus.textContent = `Firebase: ${error.message}`; }
    };
    featuredBtn.onclick = async () => {
      if (display.mode !== "arcade") {
        arcadeStatus.textContent = "Primero abre TRASA Arcade.";
        return;
      }
      try {
        await f.dbMod.update(displayRef, {
          featuredUid: featuredSelect.value, updatedAt: f.dbMod.serverTimestamp()
        });
      } catch (error) { arcadeStatus.textContent = `Firebase: ${error.message}`; }
    };

    delBtn.onclick = async () => {
      const uid = userSelect.value;
      if (!uid) { adminStatus.textContent = "Selecciona un participante."; return; }
      const name = userSelect.selectedOptions[0].textContent;
      if (!window.confirm(`¿Borrar TODOS los récords e historial de ${name} y bloquear su sesión actual? Esta acción no se puede deshacer.`)) return;
      const nameOnly = [rawLive[uid], rawMemory[uid], rawRun[uid]]
        .find(info => typeof info?.name === "string")?.name || name.split(" · ")[0];
      // Una única operación atómica: borra en ambos juegos y bloquea su UID.
      try {
        adminStatus.textContent = "Borrando participante…";
        await f.dbMod.update(arcadeRef, {
          [`bans/${uid}`]: {name: nameOnly, blockedAt: f.dbMod.serverTimestamp()},
          [`live/${uid}`]: null,
          [`scores/memory/${uid}`]: null,
          [`scores/run/${uid}`]: null,
          [`scores/zona/${uid}`]: null,
          [`scores/clasifica/${uid}`]: null,
          [`history/memory/${uid}`]: null,
          [`history/run/${uid}`]: null,
          [`history/zona/${uid}`]: null,
          [`history/clasifica/${uid}`]: null
        });
        adminStatus.textContent = `Se borraron los registros y se bloqueó la sesión de ${nameOnly}.`;
      } catch (error) { adminStatus.textContent = `No se pudo borrar: ${error.message}`; }
    };

    clearAllBtn.onclick = async () => {
      if (!window.confirm("¿Borrar TODOS los jugadores activos, récords e historial de Memory, TRASA RUN y Zona Contaminada?")) return;
      if (!window.confirm("CONFIRMA EL BORRADO GENERAL. Se perderán todas las puntuaciones de forma permanente.")) return;
      try {
        adminStatus.textContent = "Eliminando todos los registros…";
        await f.dbMod.update(arcadeRef, {live:null, scores:null, history:null, resetAt: f.dbMod.serverTimestamp()});
        adminStatus.textContent = "Se han borrado todos los registros. Los bloqueos existentes se mantienen.";
      } catch (error) { adminStatus.textContent = `No se pudo borrar: ${error.message}`; }
    };

    unbanBtn.onclick = async () => {
      const uid = bannedSelect.value;
      if (!uid) {adminStatus.textContent = "Selecciona una sesión bloqueada."; return;}
      if (!window.confirm(`¿Permitir jugar de nuevo a la sesión ${uid.slice(0,8)}…?`)) return;
      try {
        await f.dbMod.remove(f.dbMod.ref(f.db, roomPath(`arcade/bans/${uid}`)));
        adminStatus.textContent = "Sesión desbloqueada. Sus puntuaciones anteriores no se recuperan.";
      } catch (error) { adminStatus.textContent = `No se pudo desbloquear: ${error.message}`; }
    };
  } catch (error) {
    arcadeStatus.textContent = `No se pudo conectar Arcade: ${error.message}`;
    adminStatus.textContent = `Error al cargar administración: ${error.message}`;
  }
} else {
  arcadeStatus.textContent = "Configura Firebase antes de usar Arcade.";
  adminStatus.textContent = "Firebase no configurado.";
}
