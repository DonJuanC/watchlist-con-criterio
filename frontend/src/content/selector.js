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
  // por ejemplo "/selector.jpg". Con null se muestra el monograma ("ES").
  portrait: "/selector.jpg",

  // Quién eres. Tu bio, en tus palabras.
  bio: [
    "Hola, soy Juan Camilo: un mortal más con pasiones divididas entre la música y la pantalla.",
  ],

  // Por qué surge este archivo.
  origin: [
    "Siempre me ha apasionado hablar de cine y de música; esta vez le tocó el turno a la pantalla y a las ganas de compartir lo que voy descubriendo.",
    "Todos nos hemos quedado en blanco en el sofá, con la tele encendida y sin saber qué poner. Creé este archivo para romper ese bucle: películas que he visto, calificadas con honestidad y conectadas entre sí para que elegir sea fácil y valga la pena.",
  ],

  // Cómo calificas. Redactado a partir de lo que ya muestra la ficha;
  // ajústalo a tu criterio real.
  scale: {
    stars: [
      { value: 5, text: "Obra maestra. Para volver a ver." },
      { value: 4, text: "Muy buena. Recomendada sin pensarlo." },
      { value: 3, text: "Cumple. Tiene momentos que valen la pena." },
      { value: 2, text: "Floja. Rescata poco." },
      { value: 1, text: "No funcionó." },
    ],
    verdicts: [
      { value: 1, label: "Imprescindible", text: "Muy recomendada." },
      {
        value: 0,
        label: "Interesante",
        text: "Recomendada con reservas: depende de a quién.",
      },
      { value: -1, label: "Prescindible", text: "Poco recomendable." },
    ],
  },

  // Enlaces opcionales. Ejemplo: { label: "Instagram", href: "https://instagram.com/..." }
  links: [
    {
      label: "Instagram (@musicaconcriterio)",
      href: "https://www.instagram.com/musicaconcriterio",
    },
    {
      label: "GitHub (@DonJuanC)",
      href: "https://github.com/DonJuanC",
    },
  ],
};
