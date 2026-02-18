const API_BASE = "https://alexlakesolo3.onrender.com".replace(/\/$/, ""); // Render backend (Netlify frontend uses cross-origin)

let currentPage = 1;
let totalPages = 1;

const grid = document.getElementById("grid");
const form = document.getElementById("movieForm");
const pageIndicator = document.getElementById("pageIndicator");
const emptyState = document.getElementById("emptyState");
const msgBox = document.getElementById("message");

// controls
const searchEl = document.getElementById("search");
const genreFilterEl = document.getElementById("genreFilter");
const sortEl = document.getElementById("sort");
const dirEl = document.getElementById("dir");
const pageSizeEl = document.getElementById("pageSize");

document.getElementById("applyBtn").addEventListener("click", () => {
  currentPage = 1;
  savePageSizeCookie();
  loadAll();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  searchEl.value = "";
  genreFilterEl.value = "";
  sortEl.value = "createdAt";
  dirEl.value = "desc";
  currentPage = 1;
  loadAll();
});

document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    loadAll();
  }
});
document.getElementById("nextBtn").addEventListener("click", () => {
  if (currentPage < totalPages) {
    currentPage++;
    loadAll();
  }
});

document.getElementById("cancelEdit").addEventListener("click", () => {
  clearForm();
});

// cookie helpers (required)
function setCookie(name, value, days = 365) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}
function getCookie(name) {
  const parts = document.cookie.split(";").map(x => x.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.substring(name.length + 1));
  }
  return null;
}
function savePageSizeCookie() {
  setCookie("pageSize", pageSizeEl.value);
}
function restorePageSizeCookie() {
  const saved = getCookie("pageSize");
  if (saved && ["5","10","20","50"].includes(saved)) {
    pageSizeEl.value = saved;
  }
}

// UI messaging
function showMessage(text, kind = "info") {
  msgBox.style.display = "block";
  msgBox.textContent = text;
  msgBox.style.borderColor = kind === "error" ? "rgba(255,120,140,0.5)" : "rgba(255,255,255,0.12)";
}
function clearMessage() {
  msgBox.style.display = "none";
  msgBox.textContent = "";
}

// field errors
function setFieldError(id, text) {
  document.getElementById(id).textContent = text || "";
}
function clearErrors() {
  setFieldError("errTitle", "");
  setFieldError("errGenre", "");
  setFieldError("errRating", "");
  setFieldError("errImageUrl", "");
}

// form helpers
function clearForm() {
  document.getElementById("movieId").value = "";
  document.getElementById("title").value = "";
  document.getElementById("genre").value = "";
  document.getElementById("rating").value = "";
  document.getElementById("imageUrl").value = "";
  clearErrors();
  clearMessage();
}

function getQueryParams() {
  const params = new URLSearchParams();
  params.set("page", String(currentPage));
  params.set("pageSize", pageSizeEl.value);
  if (searchEl.value.trim()) params.set("q", searchEl.value.trim());
  if (genreFilterEl.value) params.set("genre", genreFilterEl.value);
  params.set("sort", sortEl.value);
  params.set("dir", dirEl.value);
  return params.toString();
}

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.details = data?.details;
    throw err;
  }
  return data;
}

// list + stats
async function loadAll() {
  await Promise.all([loadPage(), loadStats()]);
}

async function loadPage() {
  clearMessage();
  const qs = getQueryParams();
  const data = await fetchJSON(`${API_BASE}/api/movies?${qs}`);

  totalPages = data.totalPages || 1;
  pageIndicator.textContent = `Page ${data.page} of ${totalPages}`;

  grid.innerHTML = "";
  if (!data.items || data.items.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  for (const m of data.items) {
    grid.appendChild(renderCard(m));
  }
}

async function loadStats() {
  const pageSize = pageSizeEl.value;
  const stats = await fetchJSON(`${API_BASE}/api/stats?pageSize=${encodeURIComponent(pageSize)}`);
  document.getElementById("totalCount").textContent = stats.total;
  document.getElementById("avgRating").textContent = stats.avgRating;
  document.getElementById("topGenre").textContent = stats.topGenre || "—";
  document.getElementById("currentPageSize").textContent = stats.currentPageSize;
}

// card rendering
function renderCard(movie) {
  const div = document.createElement("div");
  div.className = "item";

  const img = document.createElement("img");
  img.className = "thumb";
  img.src = movie.imageUrl;
  img.alt = movie.title;
  img.onerror = () => {
    img.onerror = null;
    img.src = "https://via.placeholder.com/300x200.png?text=No+Image";
  };

  const body = document.createElement("div");
  body.className = "itemBody";

  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.textContent = movie.title;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `<span>Genre: ${escapeHtml(movie.genre)}</span><span>Rating: ${movie.rating}</span>`;

  const actions = document.createElement("div");
  actions.className = "actions";

  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", () => startEdit(movie.id));

  const delBtn = document.createElement("button");
  delBtn.className = "secondary";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", () => confirmDelete(movie.id, movie.title));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  body.appendChild(title);
  body.appendChild(meta);
  body.appendChild(actions);

  div.appendChild(img);
  div.appendChild(body);
  return div;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

// CRUD
async function startEdit(id) {
  clearErrors();
  clearMessage();
  const movie = await fetchJSON(`${API_BASE}/api/movies/${id}`);
  document.getElementById("movieId").value = movie.id;
  document.getElementById("title").value = movie.title;
  document.getElementById("genre").value = movie.genre;
  document.getElementById("rating").value = movie.rating;
  document.getElementById("imageUrl").value = movie.imageUrl;
  showMessage("Editing movie. Make changes and click Save.", "info");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function confirmDelete(id, title) {
  const ok = confirm(`Delete "${title}"? This cannot be undone.`);
  if (!ok) return;

  try {
    await fetchJSON(`${API_BASE}/api/movies/${id}`, { method: "DELETE" });
    showMessage("Movie deleted.", "info");
    // if you deleted the last item on the last page, pull back a page
    if (currentPage > 1) currentPage = Math.min(currentPage, totalPages);
    await loadAll();
  } catch (e) {
    showMessage(e.message, "error");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();
  clearMessage();

  const id = document.getElementById("movieId").value.trim();
  const payload = {
    title: document.getElementById("title").value.trim(),
    genre: document.getElementById("genre").value.trim(),
    rating: Number(document.getElementById("rating").value),
    imageUrl: document.getElementById("imageUrl").value.trim(),
  };

  try {
    if (id) {
      await fetchJSON(`${API_BASE}/api/movies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showMessage("Movie updated.", "info");
    } else {
      await fetchJSON(`${API_BASE}/api/movies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      showMessage("Movie created.", "info");
    }

    clearForm();
    currentPage = 1;
    await loadAll();
  } catch (e) {
    showMessage(e.message, "error");
    if (e.details) {
      setFieldError("errTitle", e.details.title);
      setFieldError("errGenre", e.details.genre);
      setFieldError("errRating", e.details.rating);
      setFieldError("errImageUrl", e.details.imageUrl);
    }
  }
});

// init
restorePageSizeCookie();
loadAll().catch((e) => showMessage(e.message || "Failed to load data", "error"));
