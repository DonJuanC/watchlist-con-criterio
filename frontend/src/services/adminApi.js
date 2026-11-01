// frontend/src/services/adminApi.js
// CINE-11: Cliente HTTP para las operaciones del panel Criterio Studio (Admin).

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const TOKEN_KEY = "cine_admin_token";

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignorar si localStorage está deshabilitado
  }
}

async function adminFetch(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Error ${response.status} en ${path}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function searchMoviesTmdb(query) {
  const response = await fetch(
    `${API_BASE_URL}/api/movies/search?q=${encodeURIComponent(query)}`,
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "No se pudo buscar en TMDB");
  }
  return data;
}

export async function adminLogin(password) {
  const res = await adminFetch("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  if (res.token) {
    setStoredToken(res.token);
  }
  return res;
}

export async function checkAdminAuth() {
  return adminFetch("/api/admin/me", { method: "GET" });
}

export async function fetchAdminMovies({
  status = "all",
  search = "",
  limit = 100,
  offset = 0,
} = {}) {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("search", search);
  params.set("limit", limit.toString());
  params.set("offset", offset.toString());

  return adminFetch(`/api/admin/movies?${params.toString()}`, {
    method: "GET",
  });
}

export async function createAdminMovie({
  tmdb_id,
  status = "seen",
  rating = null,
  recommend = null,
  review = null,
  syncToNotion = true,
}) {
  return adminFetch("/api/admin/movies", {
    method: "POST",
    body: JSON.stringify({
      tmdb_id,
      status,
      rating,
      recommend,
      review,
      syncToNotion,
    }),
  });
}

export async function updateAdminMovie(
  id,
  { status, rating, recommend, review, syncToNotion = true },
) {
  return adminFetch(`/api/admin/movies/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      status,
      rating,
      recommend,
      review,
      syncToNotion,
    }),
  });
}

export async function deleteAdminMovie(id, { archive = true } = {}) {
  return adminFetch(`/api/admin/movies/${id}?archive=${archive}`, {
    method: "DELETE",
  });
}

export async function triggerAdminSync({
  dryRun = false,
  prune = false,
  reembed = false,
  limit = null,
} = {}) {
  return adminFetch("/api/admin/sync", {
    method: "POST",
    body: JSON.stringify({ dryRun, prune, reembed, limit }),
  });
}
