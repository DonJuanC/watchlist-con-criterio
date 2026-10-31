// src/content/selector.js
// Textos de la página «Quién elige» (#/selector).
// Edita aquí sin tocar el componente. Cada párrafo es un string del arreglo.
// Si un arreglo queda vacío, la sección no se muestra en producción
// (en local aparece un recuadro "Pendiente" para recordarte llenarla).

export const SELECTOR = {
  name: "El Selector",

  // Línea corta bajo el nombre.
  tagline: "Veo cine, lo anoto y lo conecto.",

  // Foto o ilustración: pon el archivo en frontend/public/ y escribe la ruta,
  // por ejemplo "/selector.jpg". Con null se muestra el monograma.
  portrait: null,

  // Quién eres. Tu bio, en tus palabras.
  bio: [],

  // Por qué surge este archivo.
  origin: [],

  // Cómo calificas. Redactado a partir de lo que ya muestra la ficha;
  // ajústalo a tu criterio real.
  scale: {
    stars: [
      { value: 5, text: "Obra maestra. La volvería a ver." },
      { value: 4, text: "Muy buena. La recomiendo sin pensarlo." },
      { value: 3, text: "Cumple. Tiene momentos que valen la pena." },
      { value: 2, text: "Floja. Rescato poco." },
      { value: 1, text: "No me funcionó." },
    ],
    verdicts: [
      { value: 1, label: "Imprescindible", text: "La recomiendo sin dudarlo." },
      { value: 0, label: "Interesante", text: "La recomiendo con reservas: depende de a quién." },
      { value: -1, label: "Prescindible", text: "No la recomendaría." },
    ],
  },

  // Enlaces opcionales. Ejemplo: { label: "Instagram", href: "https://instagram.com/..." }
  links: [],
};
