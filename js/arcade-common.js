// Lista de juegos activos de TRASA Arcade.
export const ARCADE_GAMES = [
  { id: "memory", name: "MEMORY DE MATERIALES", short: "Memory" },
  { id: "run", name: "TRASA RUN", short: "Run" },
  { id: "zona", name: "ZONA CONTAMINADA", short: "Zona" }
];

export const GAME_DURATION = { memory: 90, zona: 210 };

export const shuffle = source => {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};

export function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 18);
}

export function readLive(snapshotValue) {
  const now = Date.now();
  return Object.entries(snapshotValue || {})
    .map(([uid, info]) => ({ uid, ...info }))
    .filter(info =>
      (info.gameId === "memory" || info.gameId === "run" || info.gameId === "zona") &&
      typeof info.name === "string" &&
      Number(info.updatedAt || 0) > now - 22000 &&
      info.status === "playing"
    )
    .sort((a, b) => Number(a.startedAt || 0) - Number(b.startedAt || 0));
}

export function safeState(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}

// TOP 5: mejor marca de CINCO UID anónimos distintos, NO por IP.
export function scoreRanking(items) {
  return Object.entries(items || {})
    .map(([uid, item]) => ({ uid, ...item }))
    .filter(item => Number.isFinite(Number(item.score)) && typeof item.name === "string")
    .sort((a, b) => Number(b.score) - Number(a.score) || a.name.localeCompare(b.name, "es"))
    .slice(0, 5);
}
