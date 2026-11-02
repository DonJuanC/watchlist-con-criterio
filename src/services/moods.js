// src/services/moods.js
// Ánimos presets compartidos por "Sorpréndeme" y "¿Qué veo hoy?" (las mismas 6 claves que
// frontend/src/lib/moods.js). Son presets del servidor, no texto libre, para que cada uno
// cueste un solo embedding de Gemini por vida del proceso.

const { generateEmbedding } = require("./embeddings");

const MOODS = {
  pensar: "película que te deja pensando, ideas, giros, filosofía, la mente, preguntas sin respuesta",
  reir: "comedia divertida y ligera para reír, humor, absurdo, buen rato",
  adrenalina: "acción intensa, tensión, persecuciones, adrenalina, ritmo frenético",
  llorar: "drama emotivo y conmovedor, pérdida, amor, para llorar",
  miedo: "terror y suspenso inquietante, miedo, atmósfera oscura",
  culto: "película rara y de culto, extraña, original, independiente, inclasificable",
};
// Géneros que refuerzan cada ánimo (el vector solo confunde "reír" con dramas ingeniosos).
const MOOD_GENRES = {
  reir: ["Comedia"],
  miedo: ["Terror"],
  adrenalina: ["Acción"],
  llorar: ["Drama", "Romance"],
  pensar: ["Ciencia ficción", "Misterio"],
  culto: [],
};
const GENRE_BOOST = 0.05;
const GREEN_BOOST = 0.04;

const moodEmbeddings = new Map(); // key -> literal de vector

/** Clave de ánimo válida o null. */
const parseMood = (raw) => (Object.hasOwn(MOODS, raw) ? raw : null);

/** Vector del ánimo como literal de pgvector ("[0.1,…]"). */
async function moodVector(key) {
  if (!moodEmbeddings.has(key)) {
    moodEmbeddings.set(key, JSON.stringify(await generateEmbedding(MOODS[key])));
  }
  return moodEmbeddings.get(key);
}

module.exports = { MOODS, MOOD_GENRES, GENRE_BOOST, GREEN_BOOST, parseMood, moodVector };
