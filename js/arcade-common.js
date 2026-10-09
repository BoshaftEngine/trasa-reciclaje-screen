export const ARCADE_GAMES = [
  { id: "memory", name: "MEMORY DE MATERIALES", short: "Memory" },
  { id: "clasifica", name: "CLASIFICA RESIDUOS", short: "Clasifica" },
  { id: "run", name: "TRASA RUN", short: "Run" }
];

export const GAME_DURATION = { memory: 90, clasifica: 60 };

export const RECYCLING_QUESTIONS = [
  { icon: "🛞", item: "Neumático usado", answer: "caucho" },
  { icon: "🥫", item: "Lata de refresco", answer: "aluminio" },
  { icon: "🔌", item: "Cable eléctrico de cobre", answer: "cobre" },
  { icon: "🪟", item: "Cristal de una ventana", answer: "vidrio" },
  { icon: "🔋", item: "Batería de litio", answer: "litio" },
  { icon: "🧴", item: "Envase de plástico", answer: "plastico" },
  { icon: "🪵", item: "Palé de madera", answer: "madera" },
  { icon: "👕", item: "Camiseta vieja", answer: "tela" },
  { icon: "🔩", item: "Viga de acero", answer: "acero" },
  { icon: "🪨", item: "Bloque de piedra caliza", answer: "piedra_caliza" },
  { icon: "💍", item: "Anillo de oro", answer: "oro" },
  { icon: "💻", item: "Placa electrónica", answer: "componentes_electronicos" },
  { icon: "⚙️", item: "Pieza de titanio", answer: "titanio" },
  { icon: "🧪", item: "Pieza de silicona", answer: "silicona" }
];

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
      (info.gameId === "memory" || info.gameId === "clasifica" || info.gameId === "run") &&
      typeof info.name === "string" &&
      Number(info.updatedAt || 0) > now - 22000 &&
      info.status === "playing"
    )
    .sort((a, b) => Number(a.startedAt || 0) - Number(b.startedAt || 0));
}

export function safeState(value) {
  try { return JSON.parse(value || "{}"); }
  catch { return {}; }
}

export function scoreRanking(items) {
  return Object.entries(items || {})
    .map(([uid, item]) => ({ uid, ...item }))
    .filter(item => Number.isFinite(Number(item.score)) && typeof item.name === "string")
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"))
    .slice(0, 5);
}
