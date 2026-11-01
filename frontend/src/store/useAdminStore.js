// frontend/src/store/useAdminStore.js
// CINE-11: Store Zustand para la sesión y estado del panel Criterio Studio.

import { create } from "zustand";
import {
  getStoredToken,
  setStoredToken,
  adminLogin,
  checkAdminAuth,
  fetchAdminMovies,
} from "../services/adminApi";

const useAdminStore = create((set, get) => ({
  token: getStoredToken(),
  isAuthenticated: Boolean(getStoredToken()),
  isCheckingAuth: false,
  loginError: null,

  // Pestaña activa: "curate" | "catalog" | "sync"
  activeTab: "curate",
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Lista de catálogo en admin
  adminMovies: [],
  totalAdminMovies: 0,
  isLoadingMovies: false,
  movieFilterStatus: "all",
  movieSearchQuery: "",

  setMovieFilterStatus: (status) => {
    set({ movieFilterStatus: status });
    get().loadAdminMovies();
  },

  setMovieSearchQuery: (search) => {
    set({ movieSearchQuery: search });
    get().loadAdminMovies();
  },

  checkAuth: async () => {
    const currentToken = get().token;
    if (!currentToken) {
      set({ isAuthenticated: false, isCheckingAuth: false });
      return false;
    }

    set({ isCheckingAuth: true });
    try {
      await checkAdminAuth();
      set({ isAuthenticated: true, isCheckingAuth: false, loginError: null });
      return true;
    } catch {
      setStoredToken(null);
      set({
        token: "",
        isAuthenticated: false,
        isCheckingAuth: false,
      });
      return false;
    }
  },

  login: async (password) => {
    set({ isCheckingAuth: true, loginError: null });
    try {
      const res = await adminLogin(password);
      set({
        token: res.token,
        isAuthenticated: true,
        isCheckingAuth: false,
        loginError: null,
      });
      get().loadAdminMovies();
      return { success: true };
    } catch (err) {
      const msg = err.data?.error || err.message || "Error al iniciar sesión.";
      set({
        token: "",
        isAuthenticated: false,
        isCheckingAuth: false,
        loginError: msg,
      });
      return { success: false, error: msg };
    }
  },

  logout: () => {
    setStoredToken(null);
    set({
      token: "",
      isAuthenticated: false,
      loginError: null,
      adminMovies: [],
    });
  },

  loadAdminMovies: async () => {
    if (!get().isAuthenticated) return;
    set({ isLoadingMovies: true });
    try {
      const data = await fetchAdminMovies({
        status: get().movieFilterStatus,
        search: get().movieSearchQuery,
        limit: 150,
      });
      set({
        adminMovies: data.movies || [],
        totalAdminMovies: data.total || 0,
        isLoadingMovies: false,
      });
    } catch (err) {
      console.error("Error cargando películas en admin:", err);
      set({ isLoadingMovies: false });
    }
  },
}));

export default useAdminStore;
