// src/routes/api.js
// CINE-03: Enrutador principal de la API.

const express = require("express");
const router = express.Router();

const { semanticSearch } = require("../controllers/searchController");
const { getGraph } = require("../controllers/graphController");

const { getMovieById } = require("../controllers/moviesController");

router.post("/search/semantic", semanticSearch);
router.get("/graph", getGraph);
router.get("/movies/:id", getMovieById);

module.exports = router;
