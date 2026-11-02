// src/services/emotions.js
// Emociones en la búsqueda libre ("feliz", "algo para no pensar"...).
//
// El embedding mide de qué TRATA una película, no cómo te DEJA: "feliz" sola queda cerca de
// películas cuyo tema es la felicidad (The Zone of Interest, El olvido que seremos), no de las
// que dan felicidad. Y con una palabra suelta el vector casi no separa (top 12 en 0.02).
// Por eso, si la consulta nombra una emoción:
//  1) se embebe una descripción del TIPO de película que produce esa emoción, y
//  2) se refuerzan géneros afines y se castigan los que la contradicen.
//
// `match` son prefijos sobre el texto sin tildes y en minúsculas, al inicio de palabra.
// El orden importa: "relajado" va primero y consume "sin pensar"/"no pensar" para que
// "reflexivo" no lo tome por "pensar".

const EMOTIONS = [
  {
    key: "relajado",
    match: ["relaj", "tranquil", "calma", "descansar", "desconectar", "liviana", "ligera", "sin pensar", "no pensar", "para el domingo"],
    text: "película ligera y relajante para desconectar, amable y tranquila, sin complicaciones, para ver sin pensar mucho y pasar un buen rato",
    boost: ["Comedia", "Animación", "Familia", "Aventura"],
    penalize: ["Terror", "Bélica", "Suspense", "Crimen"],
  },
  {
    key: "feliz",
    match: ["feliz", "felices", "felicidad", "alegr", "content", "animad", "buen humor", "buen rollo", "sonre", "sonris", "optimis", "feel good", "feelgood", "sentir bien", "sentirme bien", "levantar el animo", "subir el animo"],
    text: "película feel-good, alegre y luminosa, que te deja de buen humor y con una sonrisa, optimista, cálida, divertida",
    boost: ["Comedia", "Animación", "Familia", "Música"],
    penalize: ["Terror", "Bélica", "Crimen"],
  },
  {
    key: "triste",
    match: ["triste", "tristeza", "llorar", "llorando", "melancol", "deprim", "bajonead", "conmov", "desgarrador"],
    text: "drama emotivo y conmovedor que te hace llorar, pérdida, duelo, amor, melancolía, catarsis",
    boost: ["Drama", "Romance"],
    penalize: ["Terror", "Acción"],
  },
  {
    key: "nostalgico",
    match: ["nostalg", "infancia", "ninez", "recuerdos", "anoranza", "anorar"],
    text: "película nostálgica sobre la infancia, la memoria y el paso del tiempo, recuerdos entrañables, crecer, amistad de juventud",
    boost: ["Familia", "Animación", "Aventura", "Drama"],
    penalize: ["Terror", "Bélica"],
  },
  {
    key: "tenso",
    match: ["tenso", "tensa", "tension", "nervios", "angusti", "al borde", "intens", "vilo"],
    text: "thriller tenso y absorbente, suspenso al borde del asiento, angustia, peligro, ritmo que no da respiro",
    boost: ["Suspense", "Acción", "Crimen"],
    penalize: ["Familia", "Animación", "Romance"],
  },
  {
    key: "reflexivo",
    match: ["reflexi", "pensar", "pensativ", "filosof", "existencial", "profund", "cuestion"],
    text: "película que te deja pensando, ideas, filosofía, preguntas sobre la existencia, la mente y la condición humana, giros, preguntas sin respuesta",
    boost: ["Ciencia ficción", "Misterio", "Drama"],
    penalize: ["Familia"],
  },
  {
    key: "romantico",
    match: ["romantic", "enamorad", "enamorar", "ternura", "tierna"],
    text: "historia de amor romántica y tierna, química entre la pareja, enamorarse, relaciones",
    boost: ["Romance"],
    penalize: ["Terror", "Bélica"],
  },
  {
    key: "inspirado",
    match: ["inspir", "motiva", "superacion", "esperanz", "valent", "ganas de vivir"],
    text: "película inspiradora y esperanzadora de superación, lucha contra la adversidad, personajes que no se rinden, te deja con ganas de cambiar tu vida",
    boost: ["Drama", "Historia", "Aventura"],
    penalize: ["Terror"],
  },
];

const fold = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compiled = EMOTIONS.map((e) => ({
  ...e,
  re: new RegExp(`(^|[^a-z0-9ñ])(${e.match.map(escape).join("|")})[a-z0-9ñ]*`, "g"),
}));

// Lo que sobra al quitar la emoción: si no queda nada con contenido, la consulta ERA la emoción.
const FILLER = new Set(["algo", "para", "como", "pelicula", "peliculas", "quiero", "quisiera", "sentir", "sentirme",
  "estar", "estoy", "una", "uno", "que", "con", "sobre", "donde", "me", "mi", "hoy", "ver", "y", "o", "de", "el", "la",
  "lo", "los", "las", "un", "muy", "mas", "bien", "rato", "dia", "noche", "ando", "tengo", "ganas"]);

/**
 * Detecta emociones en la consulta.
 * @param {string} text
 * @returns {null | { keys: string[], embedText: string, boost: string[], penalize: string[], emotionWords: Set<string> }}
 */
function detectEmotions(text) {
  let rest = fold(text);
  const hits = [];
  const emotionWords = new Set();
  for (const e of compiled) {
    let found = false;
    rest = rest.replace(e.re, (m, pre) => {
      found = true;
      m.slice(pre.length).split(/\s+/).forEach((w) => emotionWords.add(w));
      return pre + " ";
    });
    if (found) hits.push(e);
  }
  if (!hits.length) return null;

  const leftover = rest.split(/[^a-z0-9ñ]+/).filter((w) => w.length > 1 && !FILLER.has(w));
  const descr = hits.map((e) => e.text).join(". ");
  const boost = [...new Set(hits.flatMap((e) => e.boost))];
  const penalize = [...new Set(hits.flatMap((e) => e.penalize))].filter((g) => !boost.includes(g));
  return {
    keys: hits.map((e) => e.key),
    // Consulta = solo emoción → se embebe la descripción. Si trae algo más ("feliz y con
    // viajes en el tiempo"), ese contenido va primero y la emoción lo matiza.
    embedText: leftover.length ? `${text.trim()}. ${descr}` : descr,
    boost,
    penalize,
    emotionWords,
  };
}

module.exports = { EMOTIONS, detectEmotions };
