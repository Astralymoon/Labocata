const ADMIN_USER = "labocata";
const ADMIN_PASSWORD_HASH = "bd3a08007018df56d3da80919864602d8a65b69e862d0b6b3b6955c575f24031";
const CUSTOM_DISHES_KEY = "labocata_custom_dishes";
const MENU_CATEGORIES_KEY = "labocata_menu_categories";
const MENU_TAGS_KEY = "labocata_menu_tags";
const SPOTLIGHT_KEY = "labocata_spotlight_schedule";
const ADMIN_SESSION_KEY = "labocata_admin_session";
const ADMIN_LOCK_KEY = "labocata_admin_lock";
const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 10 * 60 * 1000;

const defaultCategories = [
  { id: "clasicos", label: "Clasicos" },
  { id: "bocadillos", label: "Bocadillos" },
  { id: "dulce", label: "Mesa Dulce" },
  { id: "bebidas", label: "Bebidas" }
];

const defaultTags = [
  { id: "v", label: "Vegetariano" },
  { id: "vg", label: "Vegano" },
  { id: "gf", label: "Sin gluten" },
  { id: "s", label: "Signature" },
  { id: "nuevo", label: "Nuevo" }
];

const baseMenuItems = [
  { id: "huevos-benedictinos", name: "Huevos Benedictinos", price: 189, image: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&q=80" },
  { id: "cafe-de-olla", name: "Cafe de Olla", price: 55, image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80" },
  { id: "avocado-toast", name: "Avocado Toast", price: 149, image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80" },
  { id: "chilaquiles-rojos", name: "Chilaquiles Rojos", price: 165, image: "" },
  { id: "molletes-casa", name: "Molletes de la Casa", price: 145, image: "" },
  { id: "pan-frances-guayaba", name: "Pan Frances de Guayaba", price: 168, image: "https://tofuu.getjusto.com/orioneat-local/resized2/Zey9tjDMXdXmQE4bt-1600-x.webp" },
  { id: "cold-brew", name: "Cold Brew", price: 75, image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80" },
  { id: "carajillo-frio", name: "Carajillo Frio", price: 145, image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80" }
];

const dayLabels = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42) || "item";
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCategories() {
  const saved = readJson(MENU_CATEGORIES_KEY, []);
  const merged = [...defaultCategories];
  saved.forEach((category) => {
    if (!merged.some((item) => item.id === category.id)) merged.push(category);
  });
  return merged;
}

function getTags() {
  const saved = readJson(MENU_TAGS_KEY, []);
  const merged = [...defaultTags];
  saved.forEach((tag) => {
    if (!merged.some((item) => item.id === tag.id)) merged.push(tag);
  });
  return merged;
}

function readCustomDishes() {
  return readJson(CUSTOM_DISHES_KEY, []);
}

function getAllMenuItems() {
  const customItems = readCustomDishes().map((dish) => ({
    id: `custom:${dish.id}`,
    name: dish.name,
    price: Number(dish.price) || 0,
    image: dish.image || ""
  }));
  return [...baseMenuItems, ...customItems];
}

function writeCustomDishes(dishes) {
  writeJson(CUSTOM_DISHES_KEY, dishes);
}

function getSelectedOptions(select) {
  return Array.from(select.selectedOptions || []).map((option) => option.value);
}

function parseCustomTags(value = "") {
  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readLockState() {
  return readJson(ADMIN_LOCK_KEY, { attempts: 0, lockedUntil: 0 });
}

function writeLockState(state) {
  writeJson(ADMIN_LOCK_KEY, state);
}

function isSessionValid() {
  try {
    const session = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY));
    return session && session.expiresAt > Date.now();
  } catch (e) {
    return false;
  }
}

function startSession() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ expiresAt: Date.now() + SESSION_TTL_MS }));
  localStorage.removeItem(ADMIN_LOCK_KEY);
}

function setStatus(message) {
  const status = document.getElementById("adminStatus");
  if (status) status.textContent = message;
}

function getTagLabelMap() {
  return getTags().reduce((map, tag) => {
    map[tag.id] = tag.label;
    return map;
  }, {});
}

function hydrateCatalogControls() {
  const categorySelect = document.getElementById("adminCategory");
  const tagSelect = document.getElementById("adminTags");

  categorySelect.innerHTML = getCategories()
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.label)}</option>`)
    .join("");

  tagSelect.innerHTML = getTags()
    .map((tag) => `<option value="${escapeHtml(tag.id)}">${escapeHtml(tag.label)}</option>`)
    .join("");

  hydrateSpotlightItemSelects();
}

function hydrateSpotlightItemSelects() {
  const options = getAllMenuItems()
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} - $${Number(item.price).toLocaleString("es-MX")}</option>`)
    .join("");
  ["spotlightItemOne", "spotlightItemTwo"].forEach((id) => {
    const select = document.getElementById(id);
    if (select) select.innerHTML = options;
  });
}

function renderCatalogLists() {
  const categoryList = document.getElementById("categoryList");
  const tagList = document.getElementById("tagList");
  const customCategories = getCategories().filter((category) => !defaultCategories.some((item) => item.id === category.id));
  const customTags = getTags().filter((tag) => !defaultTags.some((item) => item.id === tag.id));

  categoryList.innerHTML = customCategories.length
    ? customCategories.map((category) => `<button class="admin-chip" type="button" data-kind="category" data-id="${escapeHtml(category.id)}">${escapeHtml(category.label)} <span>x</span></button>`).join("")
    : `<span class="admin-chip muted">Sin categorias extra</span>`;

  tagList.innerHTML = customTags.length
    ? customTags.map((tag) => `<button class="admin-chip" type="button" data-kind="tag" data-id="${escapeHtml(tag.id)}">${escapeHtml(tag.label)} <span>x</span></button>`).join("")
    : `<span class="admin-chip muted">Sin etiquetas extra</span>`;

  document.querySelectorAll(".admin-chip[data-kind]").forEach((chip) => {
    chip.addEventListener("click", () => removeCatalogItem(chip.dataset.kind, chip.dataset.id));
  });
}

function removeCatalogItem(kind, id) {
  const dishes = readCustomDishes();
  if (kind === "category" && dishes.some((dish) => dish.category === id)) {
    setStatus("No puedes borrar una categoria que tiene platillos.");
    return;
  }

  if (kind === "tag" && dishes.some((dish) => (dish.tags || []).includes(id))) {
    setStatus("No puedes borrar una etiqueta que esta en uso.");
    return;
  }

  const key = kind === "category" ? MENU_CATEGORIES_KEY : MENU_TAGS_KEY;
  const next = readJson(key, []).filter((item) => item.id !== id);
  writeJson(key, next);
  hydrateCatalogControls();
  renderCatalogLists();
  renderPreview();
  setStatus(kind === "category" ? "Categoria eliminada." : "Etiqueta eliminada.");
}

function addCatalogItem(kind, label) {
  const clean = String(label || "").trim();
  if (!clean) return;

  const key = kind === "category" ? MENU_CATEGORIES_KEY : MENU_TAGS_KEY;
  const defaults = kind === "category" ? defaultCategories : defaultTags;
  const current = readJson(key, []);
  const id = slugify(clean);
  if ([...defaults, ...current].some((item) => item.id === id)) {
    setStatus("Ese elemento ya existe.");
    return;
  }

  current.push({ id, label: clean });
  writeJson(key, current);
  hydrateCatalogControls();
  renderCatalogLists();
  setStatus(kind === "category" ? "Categoria agregada." : "Etiqueta agregada.");
}

function getFormDish(useFallbacks = true) {
  const form = document.getElementById("adminDishForm");
  const data = new FormData(form);
  const style = String(data.get("style") || "auto");
  const name = String(data.get("name") || "").trim();
  const description = String(data.get("description") || "").trim();
  return {
    id: String(data.get("editingDishId") || ""),
    name: name || (useFallbacks ? "Nombre del platillo" : ""),
    price: Number(data.get("price")) || 0,
    description: description || (useFallbacks ? "Descripcion del platillo con ingredientes principales." : ""),
    category: style.startsWith("drink") ? "bebidas" : String(data.get("category") || "clasicos"),
    style,
    image: String(data.get("image") || "").trim(),
    tags: getSelectedOptions(document.getElementById("adminTags")),
    customTags: parseCustomTags(data.get("customTags")),
    featured: Boolean(data.get("featured"))
  };
}

function getDishRenderStyle(dish) {
  if (dish.style && dish.style !== "auto") return dish.style;
  if (dish.category === "bebidas") return dish.featured ? "drink-featured" : "drink";
  if (dish.featured && dish.image) return "featured";
  if (dish.image) return "photo";
  return "text";
}

function renderTagSpans(dish) {
  const tagLabels = getTagLabelMap();
  const systemTags = (dish.tags || [])
    .filter((tag) => tagLabels[tag])
    .map((tag) => {
      const className = defaultTags.some((item) => item.id === tag) ? tag : "custom";
      return `<span class="item-tag ${className}">${escapeHtml(tagLabels[tag])}</span>`;
    })
    .join("");
  const extraTags = (dish.customTags || [])
    .map((tag) => `<span class="item-tag custom">${escapeHtml(tag)}</span>`)
    .join("");
  return systemTags + extraTags;
}

function renderPreviewCard(dish) {
  const style = getDishRenderStyle(dish);
  const hasImage = Boolean(dish.image);
  const usePhoto = hasImage && style !== "text";
  const isDrink = style === "drink" || style === "drink-featured";
  const isFeatured = style === "featured" || style === "drink-featured";
  const tags = renderTagSpans(dish);
  const img = usePhoto ? `<div class="${isDrink ? "bebida-photo" : "item-photo"}"><img src="${escapeHtml(dish.image)}" alt="${escapeHtml(dish.name)}" /></div>` : "";

  if (isDrink) {
    return `
      <div class="bebida-item admin-preview-item${isFeatured && usePhoto ? " bebida-featured" : ""}${usePhoto ? "" : " no-photo"}">
        ${img}
        <div class="bebida-body">
          <span class="bebida-num">Preview</span>
          <div class="bebida-name">${escapeHtml(dish.name)}</div>
          <p class="bebida-desc">${escapeHtml(dish.description)}</p>
          <div class="item-footer">
            <span class="bebida-price">$${Number(dish.price).toLocaleString("es-MX")}</span>
            <button class="add-btn" type="button">Agregar</button>
          </div>
        </div>
      </div>
    `;
  }

  if (isFeatured && usePhoto) {
    return `
      <div class="menu-item featured admin-preview-item">
        ${img}
        <div class="item-body">
          <span class="featured-badge">Destacado</span>
          <div class="item-header">
            <h3 class="item-name">${escapeHtml(dish.name)}</h3>
            <span class="item-price">$${Number(dish.price).toLocaleString("es-MX")}</span>
          </div>
          <p class="item-desc">${escapeHtml(dish.description)}</p>
          <div class="item-footer"><div class="item-tags">${tags}</div><button class="add-btn" type="button">Agregar</button></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="menu-item ${usePhoto ? "has-photo" : "text-card"} admin-preview-item">
      ${usePhoto ? `${img}<div class="item-body">` : ""}
      <div class="item-header">
        <h3 class="item-name">${escapeHtml(dish.name)}</h3>
        <span class="item-price">$${Number(dish.price).toLocaleString("es-MX")}</span>
      </div>
      <p class="item-desc">${escapeHtml(dish.description)}</p>
      <div class="item-footer"><div class="item-tags">${tags}</div><button class="add-btn" type="button">Agregar</button></div>
      ${usePhoto ? "</div>" : ""}
    </div>
  `;
}

function renderPreview() {
  document.getElementById("adminPreviewStage").innerHTML = renderPreviewCard(getFormDish());
}

function setupImageUpload() {
  const fileInput = document.getElementById("adminImageFile");
  const imageInput = document.getElementById("adminImage");
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      imageInput.value = String(reader.result || "");
      renderPreview();
      setStatus("Imagen cargada para vista previa.");
    });
    reader.readAsDataURL(file);
  });
}

function setFormMode(dish = null) {
  const form = document.getElementById("adminDishForm");
  const cancelBtn = document.getElementById("cancelEditBtn");
  const modeLabel = document.getElementById("formModeLabel");

  form.reset();
  document.getElementById("editingDishId").value = "";
  Array.from(document.getElementById("adminTags").options).forEach((option) => (option.selected = false));

  if (dish) {
    document.getElementById("editingDishId").value = dish.id;
    document.getElementById("adminName").value = dish.name || "";
    document.getElementById("adminPrice").value = dish.price || "";
    document.getElementById("adminCategory").value = dish.category || "clasicos";
    document.getElementById("adminStyle").value = dish.style || "auto";
    document.getElementById("adminDescription").value = dish.description || "";
    document.getElementById("adminImage").value = dish.image || "";
    document.getElementById("adminCustomTags").value = (dish.customTags || []).join(", ");
    document.getElementById("adminFeatured").checked = Boolean(dish.featured);
    Array.from(document.getElementById("adminTags").options).forEach((option) => {
      option.selected = (dish.tags || []).includes(option.value);
    });
    modeLabel.textContent = "Editando platillo";
    cancelBtn.hidden = false;
  } else {
    modeLabel.textContent = "Nuevo platillo";
    cancelBtn.hidden = true;
  }

  renderPreview();
}

function renderDishList() {
  const list = document.getElementById("adminDishList");
  const count = document.getElementById("dishCount");
  const dishes = readCustomDishes();
  const tagLabels = getTagLabelMap();
  const categoryLabels = getCategories().reduce((map, category) => {
    map[category.id] = category.label;
    return map;
  }, {});

  count.textContent = `${dishes.length} platillo${dishes.length !== 1 ? "s" : ""}`;
  if (dishes.length === 0) {
    list.innerHTML = `<div class="admin-empty">Todavia no hay platillos agregados desde admin.</div>`;
    return;
  }

  list.innerHTML = dishes.map((dish) => {
    const systemTags = (dish.tags || []).map((tag) => tagLabels[tag]).filter(Boolean);
    const customTags = dish.customTags || [];
    const tags = [...systemTags, ...customTags].join(" / ");
    return `
      <article class="admin-dish-row">
        <div>
          <span>${escapeHtml(categoryLabels[dish.category] || dish.category)}</span>
          <h3>${escapeHtml(dish.name)}</h3>
          <p>${escapeHtml(dish.description)}</p>
          <small>${escapeHtml(tags || "Sin etiquetas")} / ${escapeHtml(dish.style || "auto")}${dish.featured ? " / Destacado" : ""}</small>
        </div>
        <div class="admin-dish-meta">
          <strong>$${Number(dish.price).toLocaleString("es-MX")}</strong>
          <button class="admin-row-btn" type="button" data-action="edit" data-id="${escapeHtml(dish.id)}">Editar</button>
          <button class="admin-row-btn danger" type="button" data-action="delete" data-id="${escapeHtml(dish.id)}">Borrar</button>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dishes = readCustomDishes();
      if (btn.dataset.action === "edit") {
        const dish = dishes.find((item) => item.id === btn.dataset.id);
        if (dish) setFormMode(dish);
        return;
      }

      writeCustomDishes(dishes.filter((dish) => dish.id !== btn.dataset.id));
      renderDishList();
      hydrateSpotlightItemSelects();
      renderSpotlightList();
      setFormMode();
      setStatus("Platillo borrado.");
    });
  });
}

function getSpotlightSchedule() {
  return readJson(SPOTLIGHT_KEY, {});
}

function getMenuItemById(id) {
  return getAllMenuItems().find((item) => item.id === id) || null;
}

function renderSpotlightList() {
  const list = document.getElementById("spotlightList");
  const schedule = getSpotlightSchedule();
  list.innerHTML = dayLabels.map((label, day) => {
    const config = schedule[String(day)];
    if (!config) {
      return `<div class="admin-empty compact">${label}: sin configurar</div>`;
    }
    return `
      <article class="admin-dish-row compact">
        <div>
          <span>${label}</span>
          <h3>${escapeHtml(config.title)}</h3>
          <p>${escapeHtml(config.description || "Combo sugerido del dia.")}</p>
        </div>
        <div class="admin-dish-meta"><strong>$${Number(config.total || 0).toLocaleString("es-MX")}</strong></div>
      </article>
    `;
  }).join("");
}

function loadSpotlightDay(day) {
  const config = getSpotlightSchedule()[String(day)];
  const items = getAllMenuItems();
  document.getElementById("spotlightTitle").value = config ? config.title : "";
  document.getElementById("spotlightDescription").value = config ? config.description : "";
  document.getElementById("spotlightItemOne").value = config ? config.items[0]?.id || items[0]?.id || "" : items[0]?.id || "";
  document.getElementById("spotlightItemTwo").value = config ? config.items[1]?.id || items[1]?.id || "" : items[1]?.id || "";
}

function setupSpotlightForm() {
  const form = document.getElementById("spotlightForm");
  const daySelect = document.getElementById("spotlightDay");
  daySelect.addEventListener("change", () => loadSpotlightDay(daySelect.value));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const first = getMenuItemById(document.getElementById("spotlightItemOne").value);
    const second = getMenuItemById(document.getElementById("spotlightItemTwo").value);
    if (!first || !second) {
      setStatus("Selecciona dos platillos para el imperdible.");
      return;
    }

    const schedule = getSpotlightSchedule();
    const title = document.getElementById("spotlightTitle").value.trim() || `${first.name} + ${second.name}`;
    const description = document.getElementById("spotlightDescription").value.trim() || "Combo sugerido para disfrutar hoy.";
    schedule[String(daySelect.value)] = {
      title,
      description,
      total: Number(first.price) + Number(second.price),
      items: [first, second]
    };
    writeJson(SPOTLIGHT_KEY, schedule);
    renderSpotlightList();
    setStatus(`Imperdible de ${dayLabels[Number(daySelect.value)]} guardado.`);
  });

  loadSpotlightDay(daySelect.value);
  renderSpotlightList();
}

function showDashboard(show) {
  document.getElementById("loginView").hidden = show;
  document.getElementById("dashboardView").hidden = !show;
  if (show) {
    hydrateCatalogControls();
    renderCatalogLists();
    renderDishList();
    renderPreview();
    hydrateSpotlightItemSelects();
    renderSpotlightList();
  }
}

function setupLogin() {
  const form = document.getElementById("loginForm");
  const error = document.getElementById("loginError");

  if (isSessionValid()) showDashboard(true);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const lock = readLockState();
    if (lock.lockedUntil > Date.now()) {
      const minutes = Math.ceil((lock.lockedUntil - Date.now()) / 60000);
      error.textContent = `Demasiados intentos. Intenta en ${minutes} min.`;
      return;
    }

    const user = document.getElementById("adminUser").value.trim();
    const passwordHash = await sha256(document.getElementById("adminPassword").value);
    if (user !== ADMIN_USER || passwordHash !== ADMIN_PASSWORD_HASH) {
      const attempts = (lock.attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCK_TIME_MS : 0;
      writeLockState({ attempts, lockedUntil });
      error.textContent = lockedUntil
        ? "Demasiados intentos. Acceso bloqueado por 10 min."
        : `Acceso incorrecto. Intento ${attempts} de ${MAX_LOGIN_ATTEMPTS}.`;
      return;
    }

    error.textContent = "";
    startSession();
    showDashboard(true);
  });
}

function setupDishForm() {
  const form = document.getElementById("adminDishForm");

  form.addEventListener("input", renderPreview);
  form.addEventListener("change", renderPreview);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const dish = getFormDish(false);
    if (!dish.name || dish.price <= 0 || !dish.description) {
      setStatus("Completa nombre, precio y descripcion.");
      return;
    }

    if (["photo", "featured", "drink-featured"].includes(dish.style) && !dish.image) {
      setStatus("Ese estilo necesita una URL de imagen.");
      return;
    }

    const dishes = readCustomDishes();
    const existingIndex = dishes.findIndex((item) => item.id === dish.id);
    const savedDish = {
      ...dish,
      id: dish.id || `${Date.now()}-${slugify(dish.name)}`
    };

    if (existingIndex >= 0) dishes[existingIndex] = savedDish;
    else dishes.push(savedDish);

    writeCustomDishes(dishes);
    renderDishList();
    hydrateSpotlightItemSelects();
    setFormMode();
    setStatus(`${savedDish.name} guardado.`);
  });

  document.getElementById("cancelEditBtn").addEventListener("click", () => setFormMode());

  document.getElementById("clearCustomDishes").addEventListener("click", () => {
    writeCustomDishes([]);
    renderDishList();
    hydrateSpotlightItemSelects();
    renderSpotlightList();
    setFormMode();
    setStatus("Todos los platillos agregados fueron eliminados.");
  });
}

function setupCatalogForms() {
  document.getElementById("categoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("newCategoryName");
    addCatalogItem("category", input.value);
    input.value = "";
  });

  document.getElementById("tagForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("newTagName");
    addCatalogItem("tag", input.value);
    input.value = "";
  });
}

function setupLogout() {
  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    document.getElementById("adminUser").value = "";
    document.getElementById("adminPassword").value = "";
    showDashboard(false);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  hydrateCatalogControls();
  renderCatalogLists();
  setupLogin();
  setupDishForm();
  setupImageUpload();
  setupCatalogForms();
  setupSpotlightForm();
  setupLogout();
});
