// src/routes/api.js
// CINE-03: Enrutador principal de la API.

const express = require("express");
const router = express.Router();

const { semanticSearch } = require("../controllers/searchController");
const { getGraph } = require("../controllers/graphController");

const {
  getMovieById,
  searchExternal,
  getExternalMovie,
} = require("../controllers/moviesController");
const { getNeighbors } = require("../controllers/neighborsController");
const { recommend } = require("../controllers/recommendController");
const { surprise } = require("../controllers/surpriseController");
const { beyond } = require("../controllers/beyondController");
const { getNextUp } = require("../controllers/nextUpController");
const { getWatch } = require("../controllers/watchController");
const { triggerSync } = require("../controllers/syncController");
const adminRouter = require("./admin");

router.use("/admin", adminRouter);

router.get("/movies/search", searchExternal);
router.get("/movies/external/:tmdbId", getExternalMovie);
router.get("/movies/:id/neighbors", getNeighbors);
router.post("/search/semantic", semanticSearch);
router.get("/graph", getGraph);
router.get("/movies/:id", getMovieById);
router.post("/recommend", recommend);
router.get("/recommend/next", getNextUp);
router.get("/recommend/surprise", surprise);
router.post("/beyond", beyond);
router.get("/watch/:tmdbId", getWatch);
router.all("/sync", triggerSync);

module.exports = router;
