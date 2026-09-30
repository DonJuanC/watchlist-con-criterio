# Watchlist con Criterio — Grafo de Conexiones

Explorador de cine de autor que va más allá de "películas parecidas por género": construye
un **grafo de conexiones reales** entre películas — mismo director, y afinidad semántica por
tema/tono/atmósfera calculada con embeddings — y lo deja navegar visualmente, con búsqueda en
lenguaje natural ("thriller psicológico sobre identidad y dobles").

**Demo en producción:** https://frontend-juan-selector.vercel.app
**API:** https://watchlist-con-criterio.onrender.com

## El problema

Los sistemas de recomendación de streaming agrupan por género/keyword y terminan sugiriendo lo
obvio. Este proyecto responde una pregunta distinta: *¿qué conecta realmente a estas películas,
más allá del catálogo?* — autoría (mismo director) y afinidad de contenido (tema, tono,
sensación), no metadata superficial. El resultado se explora como un grafo, no como una lista.

## Arquitectura

```
┌──────────┐    ┌───────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│  TMDB    │───▶│  Gemini Embeddings │──▶│  Neon (pgvector)  │───▶│  React Force Graph  │
│  (data)  │    │  (768 dims)        │    │  HNSW + k-NN      │    │  (Canvas 2D)        │
└──────────┘    └───────────────────┘    └──────────────────┘    └────────────────────┘
   título,         texto semántico          cosine distance          nodos + aristas
   director,       (título+géneros+         <=> operator,            renderizadas sin
   sinopsis,       sinopsis) → vector        índice HNSW              reiniciar física
   poster
```

1. **Ingesta** (`scripts/seed.js`): por cada título, se busca en TMDB, se extrae director/DoP/
   género/sinopsis, y se genera un embedding de 768 dimensiones con `gemini-embedding-001`
   (Matryoshka representation, truncado desde 3072 a 768 para calzar con el esquema).
2. **Almacenamiento** (`schema.sql`): PostgreSQL en Neon con la extensión `pgvector`, columna
   `embedding vector(768)` e índice `HNSW` (`vector_cosine_ops`) para búsqueda aproximada de
   vecinos más cercanos en escala.
3. **Cálculo del grafo** (`src/controllers/graphController.js`): dos tipos de arista —
   `same_director` (JOIN directo por director) y `semantic_similarity` (k-NN top-2 vía
   `CROSS JOIN LATERAL` con piso de similitud 0.65).
4. **Frontend** (`react-force-graph-2d` + Zustand): el grafo completo se trae una vez; todo el
   filtrado (afinidad mínima, tipos de arista, búsqueda) ocurre en memoria en el cliente, sin
   volver a pedirle nada al backend ni reiniciar la simulación física del grafo.

## Decisiones de diseño

**k-NN top-2 en vez de umbral fijo de similitud.** La primera iteración usaba un umbral fijo
(similitud ≥ 0.78) para crear aristas semánticas — con un dataset chico, eso daba **cero**
aristas: pocas películas superaban ese piso entre sí. El problema no era el umbral en sí, sino
que un umbral fijo global no se adapta a la densidad local del espacio de embeddings. La solución
fue invertir la pregunta: en vez de "¿qué pares superan X similitud?", preguntar "¿cuáles son los
2 vecinos más cercanos de cada película?" (`CROSS JOIN LATERAL ... ORDER BY embedding <=> embedding
LIMIT 2`), y usar el umbral (0.65) solo como piso de calidad, no como filtro principal. Esto
garantiza que **todo nodo tenga al menos una conexión semántica candidata**, independientemente
de qué tan denso o disperso esté su vecindario — al costo de un trade-off conocido: el filtro de
deduplicación `id_a < id_b` puede descartar un par válido si solo un lado lo identifica como su
top-2 vecino y ese lado tiene el id mayor. Aceptado conscientemente por simplicidad.

**Cold start del free tier, resuelto sin pagar por infraestructura "siempre despierta".**
Render duerme el backend tras inactividad; el primer request tras dormir tarda 30-60s. En vez de
pagar por un plan que evite esto, el frontend usa un patrón de dos temporizadores: un
`AbortController` con timeout de 90s da margen para que Render despierte, y un timer aparte de 3s
activa un banner ("Reactivando servidor...") si la respuesta tarda más de lo normal — así el
usuario nunca ve una pantalla en blanco sin explicación, sin necesitar infraestructura de pago.

**Canvas re-renderiza sin reiniciar la física.** `react-force-graph-2d` reinicia su simulación
de fuerzas si el array de `nodes` cambia de referencia. Como los controles de filtrado (afinidad
mínima, tipo de arista) y la búsqueda semántica cambian constantemente qué se *ve*, pero nunca el
grafo base, el store separa `rawGraph.nodes` (referencia estable, solo cambia al cargar un grafo
nuevo) de un hook derivado `useFilteredLinks()` que recalcula solo el array de `links` vía
`useMemo`. El resultado: mover el slider de afinidad o buscar un tema nunca hace que los nodos
"salten" a posiciones nuevas — la física corrió una sola vez, al cargar.

**Heurística de matching de TMDB.** Buscar por título exacto contra resultados de TMDB falla de
formas no triviales: coincidencia por popularidad pura rompe con títulos ambiguos ("Roma" →
"Room in Rome"), y buscar en español (`es-MX`) hace que películas con título original no inglés
casi nunca calcen exacto contra el query en inglés, dejando pasar homónimos irrelevantes (un
"Parasite" de 1982 en vez del film de Bong Joon-ho). La heurística final combina: coincidencia
exacta de título O título original, con un piso mínimo de popularidad, y un fallback a
popularidad + disponibilidad de poster — con casos residuales resueltos a mano vía matching por
director en los créditos.

## Stack — $0 USD / mes

| Capa               | Servicio                          | Free tier usado |
|---------------------|-----------------------------------|-----------------|
| Frontend            | Vercel                            | Hobby (100 GB bandwidth) |
| Backend             | Render                            | Free Web Service (duerme tras 15 min inactivo) |
| Base de datos       | Neon (PostgreSQL + pgvector)      | Free tier serverless |
| Embeddings          | Google AI Studio — Gemini API     | `gemini-embedding-001`, free tier |
| Metadata de cine    | TMDB API                          | Free tier oficial |
| Control de versiones| GitHub                            | Repo privado, gratis |

## Métricas del dataset actual

- **114** películas curadas en 13 clústeres autorales/temáticos (Nolan, Fincher, Villeneuve,
  Bong Joon-ho, Lanthimos, Lynch, Kubrick, Park Chan-wook, Wong Kar-wai, Haneke, sci-fi
  reflexivo, drama de autor contemporáneo, noir/crimen, terror atmosférico).
- **248** aristas totales: 148 por `same_director`, 100 por `semantic_similarity` (top-2, piso
  de similitud 0.65).

## Correr en local

```bash
# Backend
git clone <repo>
cd watchlist-con-criterio
cp .env.example .env   # completar DATABASE_URL (Neon), TMDB_API_KEY, GEMINI_API_KEY
npm install
npm run test:db        # valida la conexión a Neon
npm run seed           # puebla la base (rate-limited, ~114 títulos)
npm run dev            # levanta la API en :4000

# Frontend (en otra terminal)
cd frontend
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:4000
npm install
npm run dev            # levanta Vite en :5173
```

Requisitos: cuenta en [Neon](https://neon.tech) con la extensión `vector` habilitada, API key de
[TMDB](https://www.themoviedb.org/settings/api), y API key de
[Google AI Studio](https://aistudio.google.com/apikey).
