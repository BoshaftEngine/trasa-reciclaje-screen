import { loadFirebase, roomPath, isFirebaseConfigured } from "./common.js";
import { readLive, ARCADE_GAMES } from "./arcade-common.js?v=2";

const openBtn = document.getElementById("openArcadeBtn");
const featuredSelect = document.getElementById("arcadeFeaturedPlayer");
const featuredBtn = document.getElementById("arcadeFeaturedBtn");
const arcadeStatus = document.getElementById("arcadeControlStatus");
const gameUrl = new URL("juego.html", document.baseURI).href;
const link = document.getElementById("arcadeLink");
const copyBtn = document.getElementById("copyArcadeLink");
link.href = gameUrl;
link.textContent = gameUrl;
copyBtn.onclick = async () => {
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
    let display = {};
    let players = [];

    f.dbMod.onValue(displayRef, snap => {
      display = snap.val() || {};
      openBtn.textContent = display.mode === "arcade" ? "ARCADE ACTIVADO" : "ABRIR TRASA ARCADE";
      arcadeStatus.textContent = display.mode === "arcade"
        ? "La pantalla muestra TRASA Arcade. Puedes destacar un jugador."
        : "La pantalla no está en modo Arcade.";
      featuredSelect.value = display.featuredUid || "";
    });

    f.dbMod.onValue(liveRef, snap => {
      players = readLive(snap.val());
      const selected = featuredSelect.value;
      featuredSelect.innerHTML = "";
      featuredSelect.add(new Option("Automático (primero en jugar)", ""));
      for (const p of players) {
        featuredSelect.add(new Option(`${p.name} · ${ARCADE_GAMES.find(g => g.id === p.gameId)?.short || p.gameId} · ${p.score} pt`, p.uid));
      }
      featuredSelect.value = [...featuredSelect.options].some(o => o.value === selected)
        ? selected : "";
    });

    openBtn.onclick = async () => {
      try {
        await f.dbMod.set(displayRef, {
          mode: "arcade",
          featuredUid: "",
          updatedAt: f.dbMod.serverTimestamp()
        });
      } catch (error) {
        arcadeStatus.textContent = `Firebase: ${error.message}`;
      }
    };

    featuredBtn.onclick = async () => {
      if (display.mode !== "arcade") {
        arcadeStatus.textContent = "Primero abre TRASA Arcade.";
        return;
      }
      try {
        await f.dbMod.update(displayRef, {
          featuredUid: featuredSelect.value,
          updatedAt: f.dbMod.serverTimestamp()
        });
      } catch (error) {
        arcadeStatus.textContent = `Firebase: ${error.message}`;
      }
    };
  } catch (error) {
    arcadeStatus.textContent = `No se pudo conectar Arcade: ${error.message}`;
  }
} else {
  arcadeStatus.textContent = "Configura Firebase antes de usar Arcade.";
}
