// src/routes/admin.js
// CINE-11: Rutas de administración para Criterio Studio.

const express = require("express");
const router = express.Router();
const { requireAdminAuth } = require("../middleware/auth");
const {
  login,
  getMe,
  getAdminMovies,
  createMovie,
  updateMovie,
  deleteMovie,
  triggerAdminSync,
} = require("../controllers/adminController");

// Ruta pública de autenticación
router.post("/login", login);

// Rutas protegidas bajo requireAdminAuth
router.use(requireAdminAuth);

router.get("/me", getMe);
router.get("/movies", getAdminMovies);
router.post("/movies", createMovie);
router.put("/movies/:id", updateMovie);
router.delete("/movies/:id", deleteMovie);
router.post("/sync", triggerAdminSync);

module.exports = router;
