// ===== NAV SCROLL =====
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 60);
});

// ===== FILTER — Platillos =====
let filterBtns = document.querySelectorAll(".filter-btn");
let catHeaders = document.querySelectorAll(".cat-header:not(.bebidas-subheader)");
let menuGrids = document.querySelectorAll(".menu-grid:not(.bebidas-grid)");
const bebidasSection = document.querySelector(".bebidas-section");
const bebidasFilterBar = document.getElementById("bebidasFilterBar");
const bebidasGrids = document.getElementById("bebidasGrids");

function setBebidasVisible(show) {
  const val = show ? "" : "none";
  if (bebidasSection) bebidasSection.style.display = val;
  if (bebidasFilterBar) bebidasFilterBar.style.display = val;
  if (bebidasGrids) bebidasGrids.style.display = val;
}

function syncVisibleCategorySections() {
  menuGrids.forEach((grid) => {
    const hasVisibleItems = Array.from(grid.querySelectorAll(".menu-item")).some((item) => item.style.display !== "none");
    const header = document.querySelector(`.cat-header:not(.bebidas-subheader)[data-cat="${grid.dataset.cat}"]`);
    grid.style.display = hasVisibleItems ? "" : "none";
    if (header) header.style.display = hasVisibleItems ? "" : "none";
  });
}

function applyMenuFilter(btn) {
  filterBtns.forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const f = btn.dataset.filter;

  catHeaders.forEach((h) => (h.style.display = ""));
  menuGrids.forEach((g) => (g.style.display = ""));
  setBebidasVisible(true);
  document.querySelectorAll("#menuBody .menu-item").forEach((i) => (i.style.display = ""));

  if (f === "all") return;

  if (f === "bebidas") {
    catHeaders.forEach((h) => (h.style.display = "none"));
    menuGrids.forEach((g) => (g.style.display = "none"));
    setTimeout(() => bebidasSection.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return;
  }

  if (f === "vegano") {
    catHeaders.forEach((h) => (h.style.display = ""));
    menuGrids.forEach((g) => (g.style.display = ""));
    document.querySelectorAll("#menuBody .menu-item").forEach((item) => {
      item.style.display = item.querySelector(".item-tag.vg") ? "" : "none";
    });
    syncVisibleCategorySections();
    return;
  }

  catHeaders.forEach((h) => (h.style.display = h.dataset.cat === f ? "" : "none"));
  menuGrids.forEach((g) => (g.style.display = g.dataset.cat === f ? "" : "none"));
  setTimeout(() => {
    const first = document.querySelector(`.cat-header:not(.bebidas-subheader)[data-cat="${f}"]`);
    if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => applyMenuFilter(btn));
});

// ===== FILTER — Bebidas =====
function applyDrinkFilter(btn) {
  document.querySelectorAll(".bebidas-filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const f = btn.dataset.drinkFilter;
  document.querySelectorAll(".bebidas-grid").forEach((grid) => {
    grid.style.display = (f === "todas" || grid.dataset.drinkCat === f) ? "" : "none";
  });
}

document.querySelectorAll(".bebidas-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => applyDrinkFilter(btn));
});


// ===== ADMIN MENU =====
const defaultMenuCategories = [
  { id: "clasicos", label: "Clasicos" },
  { id: "bocadillos", label: "Bocadillos" },
  { id: "dulce", label: "Mesa Dulce" },
  { id: "bebidas", label: "Bebidas" }
];
const defaultMenuTags = [
  { id: "v", label: "Vegetariano" },
  { id: "vg", label: "Vegano" },
  { id: "gf", label: "Sin gluten" },
  { id: "s", label: "Signature" },
  { id: "nuevo", label: "Nuevo" }
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}


async function readCustomDishes() {
  try {
    const { data, error } = await window.supabaseClient
      .from('products')
      .select('*');
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("Error fetching products:", e);
    return [];
  }
}

async function readMenuCatalog(type, defaults) {
  // type is expected to be 'categories' or 'tags'
  // For categories, we fetch from 'categories' table
  if (type === 'categories') {
    try {
      const { data, error } = await window.supabaseClient
        .from('categories')
        .select('*');
      if (error) throw error;
      // Merge with defaults if necessary or just return data
      const merged = [...defaults];
      (data || []).forEach((item) => {
        if (!merged.some((existing) => existing.id === item.id)) merged.push({id: item.id, label: item.name});
      });
      return merged;
    } catch (e) {
      console.error("Error fetching categories:", e);
      return defaults;
    }
  }
  // For tags, we might still use defaults or a 'tags' table if added.
  return defaults;
}

// Tags are not yet migrated to Supabase tables, keeping them as defaults
function getTagLabels() {
  return defaultMenuTags.reduce((map, tag) => {
    map[tag.id] = tag.label;
    return map;
  }, {});
}

function ensureCustomCategorySection(category) {
  if (!category || category.id === "bebidas" || document.querySelector(`.menu-grid[data-cat="${category.id}"]`)) return;

  const menuBody = document.getElementById("menuBody");
  if (!menuBody) return;

  const header = document.createElement("div");
  header.className = "cat-header reveal visible admin-added-section";
  header.dataset.cat = category.id;
  header.innerHTML = `
    <div>
      <span class="cat-num">Admin — ${escapeHtml(category.label)}</span>
      <h2 class="cat-title">${escapeHtml(category.label)}</h2>
    </div>
    <p class="cat-desc">Platillos agregados desde el panel administrativo.</p>
  `;

  const grid = document.createElement("div");
  grid.className = "menu-grid admin-added-section";
  grid.dataset.cat = category.id;

  menuBody.append(header, grid);
}

async function setupDynamicMenuCatalogs() {
  const categories = await readMenuCatalog('categories', defaultMenuCategories);
  categories.forEach(ensureCustomCategorySection);

  const filterInner = document.querySelector(".filter-inner");
  if (!filterInner) return;

  categories.forEach((category) => {
    if (category.id === "bebidas" || filterInner.querySelector(`[data-filter="${category.id}"]`)) return;
    const divider = document.createElement("div");
    divider.className = "filter-divider admin-added-filter";
    const button = document.createElement("button");
    button.className = "filter-btn admin-added-filter";
    button.dataset.filter = category.id;
    button.type = "button";
    button.textContent = category.label;
    button.addEventListener("click", () => applyMenuFilter(button));
    const dietary = filterInner.querySelector(".filter-dietary");
    filterInner.insertBefore(divider, dietary);
    filterInner.insertBefore(button, dietary);
  });
  filterBtns = document.querySelectorAll(".filter-btn");
  catHeaders = document.querySelectorAll(".cat-header:not(.bebidas-subheader)");
  menuGrids = document.querySelectorAll(".menu-grid:not(.bebidas-grid)");
}

function getCategoryGrid(dish) {
  const category = typeof dish === "string" ? dish : dish.category_id;
  if (category === "bebidas") {
    const sub = (typeof dish === "object" && dish.drinkSubcat) ? dish.drinkSubcat : "caliente";
    return document.querySelector(`.bebidas-grid[data-drink-cat="${sub}"]`);
  }
  return document.querySelector(`.menu-grid[data-cat="${category}"]`);
}

function getSelectedOptions(select) {
  return Array.from(select.selectedOptions || []).map((option) => option.value);
}

function renderTagSpans(tags = [], customTags = []) {
  const tagLabels = getTagLabels();
  const systemTags = tags
    .filter((tag) => tagLabels[tag])
    .map((tag) => {
      const className = defaultMenuTags.some((item) => item.id === tag) ? tag : "custom";
      return `<span class="item-tag ${className}">${escapeHtml(tagLabels[tag])}</span>`;
    })
    .join("");
  const extraTags = customTags
    .map((tag) => `<span class="item-tag custom">${escapeHtml(tag)}</span>`)
    .join("");
  return systemTags + extraTags;
}

function getDishRenderStyle(dish) {
  if (dish.style && dish.style !== "auto") return dish.style;
  if (dish.featured && dish.image) return "featured";
  if (dish.image) return "photo";
  return "text";
}

function getOrderButtonData(btn) {
  if (btn.dataset.orderName && btn.dataset.qtyId) {
    return {
      name: normalizeItemName(btn.dataset.orderName),
      price: Number(btn.dataset.orderPrice),
      qtyId: btn.dataset.qtyId
    };
  }

  const attr = btn.getAttribute("onclick") || "";
  const args = attr.match(/addToOrder\(this,\s*'([^']+)',\s*(\d+),\s*'(qty-[^']+)'\)/);
  if (!args) return null;

  return {
    name: normalizeItemName(args[1]),
    price: Number(args[2]),
    qtyId: args[3]
  };
}

function wireOrderButton(card, dish, qtyId) {
  const btn = card.querySelector(".add-btn");
  if (!btn) return;

  btn.dataset.orderName = dish.name;
  btn.dataset.orderPrice = String(dish.price);
  btn.dataset.qtyId = qtyId;
  btn.addEventListener("click", () => addToOrder(btn, dish.name, dish.price, qtyId));
}

function renderCustomDish(dish) {
  const grid = getCategoryGrid(dish);
  if (!grid) return;

  const qtyId = `qty-admin-${dish.id}`;
  const card = document.createElement("div");
  const hasImage = Boolean(dish.image);
  const style = getDishRenderStyle(dish);
  const isFeatured = style === "featured";
  const usePhoto = hasImage && style !== "text";
  card.className = `menu-item admin-added${isFeatured && usePhoto ? " featured" : usePhoto ? " has-photo" : " text-card"}`;
  card.dataset.cat = dish.category_id;
  if (dish.category_id === "bebidas" && dish.drinkSubcat) card.dataset.drink = dish.drinkSubcat;

  if (isFeatured && usePhoto) {
    card.innerHTML = `
      <div class="item-photo"><img src="${escapeHtml(dish.image_url)}" alt="${escapeHtml(dish.name)}" loading="lazy" /></div>
      <div class="item-body">
        <span class="featured-badge">Nuevo en admin</span>
        <div class="item-header">
          <h3 class="item-name">${escapeHtml(dish.name)}</h3>
          <span class="item-price">$${Number(dish.price).toLocaleString("es-MX")}</span>
        </div>
        <p class="item-desc">${escapeHtml(dish.description)}</p>
        <div class="item-footer">
          <div class="item-tags">${renderTagSpans(dish.tags, dish.customTags)}</div>
          <div class="qty-ctrl" id="${qtyId}"></div>
          <button class="add-btn" type="button">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Agregar
          </button>
        </div>
      </div>
    `;
  } else {
    card.innerHTML = `
      ${hasImage ? `<div class="item-photo"><img src="${escapeHtml(dish.image_url)}" alt="${escapeHtml(dish.name)}" loading="lazy" /></div><div class="item-body">` : ""}
      <div class="item-header">
        <h3 class="item-name">${escapeHtml(dish.name)}</h3>
        <span class="item-price">$${Number(dish.price).toLocaleString("es-MX")}</span>
      </div>
      <p class="item-desc">${escapeHtml(dish.description)}</p>
      <div class="item-footer">
        <div class="item-tags">${renderTagSpans(dish.tags, dish.customTags)}</div>
        <div class="qty-ctrl" id="${qtyId}"></div>
        <button class="add-btn" type="button">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Agregar
        </button>
      </div>
      ${hasImage ? "</div>" : ""}
    `;
  }

  wireOrderButton(card, dish, qtyId);
  grid.appendChild(card);
  prepareCardAnimation(card);
  if (orderItems[dish.name]) syncInlineControlForItem(dish.name);
}

async function renderCustomDishes() {
  document.querySelectorAll(".admin-added").forEach((card) => card.remove());
  const dishes = await readCustomDishes();
  dishes.forEach(renderCustomDish);
}

function setupAdminPanel() {
  const form = document.getElementById("adminDishForm");
  const clearBtn = document.getElementById("clearCustomDishes");
  const status = document.getElementById("adminStatus");
  const productList = document.getElementById("adminProductList");

  if (!form) return;

  const refreshAdminList = async () => {
    if (!productList) return;
    const dishes = await readCustomDishes();
    productList.innerHTML = "";
    dishes.forEach(dish => {
      const li = document.createElement("li");
      li.className = "product-item";
      li.innerHTML = `
        <span><strong>${escapeHtml(dish.name)}</strong> - $${dish.price}</span>
        <div class="product-actions">
          <button class="btn-edit" onclick="editProduct('${dish.id}')">Editar</button>
          <button class="btn-delete" onclick="deleteProduct('${dish.id}', '${escapeHtml(dish.name)}')">Borrar</button>
        </div>
      `;
      productList.appendChild(li);
    });
  };

  window.editProduct = async (id) => {
    const { data, error } = await window.supabaseClient.from('products').select('*').eq('id', id).single();
    if (data) {
      document.getElementById("dishId").value = data.id;
      document.getElementById("name").value = data.name;
      document.getElementById("price").value = data.price;
      document.getElementById("description").value = data.description;
      document.getElementById("category").value = data.category_id;
      document.getElementById("image").value = data.image_url || "";
      document.getElementById("featured").checked = data.featured;
      // Tags handling might be tricky with multiple select
      const tagSelect = document.getElementById("adminTags");
      Array.from(tagSelect.options).forEach(opt => {
        opt.selected = (data.tags || []).includes(opt.value);
      });
      status.textContent = "Editando: " + data.name;
      status.className = "status-msg success";
      status.style.display = "block";
    }
  };

  window.deleteProduct = async (id, name) => {
    if (confirm(`¿Estás seguro de borrar "${name}"?`)) {
      const { error } = await window.supabaseClient.from('products').delete().eq('id', id);
      if (error) {
        status.textContent = "Error al borrar: " + error.message;
        status.className = "status-msg error";
      } else {
        status.textContent = "Producto borrado.";
        status.className = "status-msg success";
        await refreshAdminList();
        await renderCustomDishes();
      }
      status.style.display = "block";
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const id = document.getElementById("dishId").value;
    const name = String(data.get("name") || "").trim();
    const price = Number(data.get("price"));
    const description = String(data.get("description") || "").trim();
    if (!name || !price || !description) return;

    const dish = {
      name,
      price,
      description,
      category_id: String(data.get("category") || "clasicos"),
      image_url: String(data.get("image") || "").trim(),
      tags: getSelectedOptions(document.getElementById("adminTags")),
      featured: Boolean(data.get("featured"))
    };

    let result;
    if (id) {
      result = await window.supabaseClient.from('products').update(dish).eq('id', id);
    } else {
      result = await window.supabaseClient.from('products').insert([dish]);
    }

    if (result.error) {
      status.textContent = "Error: " + result.error.message;
      status.className = "status-msg error";
    } else {
      status.textContent = id ? "Platillo actualizado." : "Platillo agregado.";
      status.className = "status-msg success";
      form.reset();
      document.getElementById("dishId").value = "";
      await refreshAdminList();
      await renderCustomDishes();
    }
    status.style.display = "block";
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      form.reset();
      document.getElementById("dishId").value = "";
      status.style.display = "none";
    });
  }

  refreshAdminList();
}
 // ===== SOUND EFFECT =====
const addSound = new Audio("Sounds/Click.mp3");
addSound.volume = 1;

let audioCtx;
function playTone(kind = "add") {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const tones = {
      add: [640, 880],
      remove: [300, 210],
      open: [420, 540],
      success: [520, 720, 980]
    }[kind] || [520];

    tones.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = kind === "remove" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      gain.gain.setValueAtTime(0.0001, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.075, now + i * 0.055 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.13);
    });
  } catch (e) {}
}

function playFeedback(kind = "add") {
  if (kind === "add") {
    addSound.currentTime = 0;
    addSound.play().catch(() => playTone(kind));
    return;
  }
  playTone(kind);
}

// ===== ORDER STATE =====
let orderItems = {};
let orderOpen = false;

function normalizeItemName(name) {
  const fixes = {
    "CafÃ© de Olla": "Café de Olla",
    "CafÃƒÂ© de Olla": "Café de Olla"
  };
  return fixes[name] || name;
}

function normalizeCartItems(items) {
  const normalized = {};
  Object.keys(items || {}).forEach((key) => {
    const item = items[key];
    const name = normalizeItemName(item.name || key);
    if (normalized[name]) {
      normalized[name].qty += item.qty || 0;
      return;
    }
    normalized[name] = { ...item, name };
  });
  return normalized;
}

// MEJORA: cargar carrito desde sesión al inicio (NO localStorage)
function loadCartFromStorage() {
  try {
    const saved = sessionStorage.getItem("labocata_cart");
    if (saved) {
      orderItems = normalizeCartItems(JSON.parse(saved));
      // Reconstruir estado visual de los botones
      Object.keys(orderItems).forEach((name) => {
        document.querySelectorAll(".add-btn").forEach((btn) => {
          const data = getOrderButtonData(btn);
          if (!data || data.name !== name) return;

          const qtyEl = document.getElementById(data.qtyId);
          if (qtyEl) {
            btn.style.display = "none";
            qtyEl.classList.add("visible");
            renderInlineQty(qtyEl, name, orderItems[name].price, btn);
          }
        });
      });
      updateCart();
    }
  } catch (e) {
    orderItems = {};
  }
}

// MEJORA: guardar carrito en sesión (NO localStorage)
function saveCartToStorage() {
  try {
    orderItems = normalizeCartItems(orderItems);
    sessionStorage.setItem("labocata_cart", JSON.stringify(orderItems));
  } catch (e) {}
}

function toggleOrder(open) {
  orderOpen = open;
  document.getElementById("orderPanel").classList.toggle("open", open);
  document.getElementById("orderOverlay").classList.toggle("open", open);
  document.body.style.overflow = open ? "hidden" : "";
  if (open) playFeedback("open");
}

// MEJORA: toast de feedback al agregar
function showToast(name, action = "agregado") {
  let toast = document.getElementById("globalToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.id = "globalToast";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<strong>${name}</strong><span>${action}</span>`;
  toast.classList.add("show");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove("show"), 2200);
}

function addToOrder(btn, name, price, qtyId) {
  name = normalizeItemName(name);

  // ===== SOUND =====
  playFeedback("add");

  // ===== MOBILE VIBRATION =====
  if (navigator.vibrate) {
    navigator.vibrate(30);
  }

  // ===== ADD ITEM =====
  if (orderItems[name]) {
    orderItems[name].qty++;
  } else {
    orderItems[name] = {
      name,
      price,
      qty: 1
    };
  }

  // ===== UI ELEMENTS =====
  const qtyEl = document.getElementById(qtyId);

  btn.style.display = "none";

  qtyEl.classList.add("visible");

  renderInlineQty(qtyEl, name, price, btn);

  // ===== UPDATE =====
  updateCart();
  bumpBadge();
  showToast(name);

  // ===== SAVE =====
  saveCartToStorage();

  // ===== BUTTON ANIMATION =====
  btn.classList.add("added");

  setTimeout(() => {
    btn.classList.remove("added");
  }, 300);
}


function renderInlineQty(el, name, price, addBtn) {
  const qty = orderItems[name] ? orderItems[name].qty : 0;
  el.innerHTML = `
    <button class="qty-btn" onclick="changeInlineQty(this,'${name}','${price}','${el.id}',null)">−</button>
    <span class="qty-num">${qty}</span>
    <button class="qty-btn" onclick="addInlineQty('${name}','${el.id}')">+</button>
  `;
}

function changeInlineQty(minusBtn, name, price, qtyId, addBtnRef) {
  if (!orderItems[name]) return;
  orderItems[name].qty--;
  playFeedback("remove");
  if (orderItems[name].qty <= 0) {
    delete orderItems[name];
    const qtyEl = document.getElementById(qtyId);
    qtyEl.classList.remove("visible");
    qtyEl.innerHTML = "";
    const addBtn = qtyEl.nextElementSibling;
    if (addBtn && addBtn.classList.contains("add-btn")) {
      addBtn.style.display = "";
      addBtn.classList.remove("added");
    }
  } else {
    document.getElementById(qtyId).querySelector(".qty-num").textContent = orderItems[name].qty;
  }
  updateCart();
  showToast(name, "actualizado");
  saveCartToStorage();
}

function addInlineQty(name, qtyId) {
  if (!orderItems[name]) return;
  orderItems[name].qty++;
  playFeedback("add");
  document.getElementById(qtyId).querySelector(".qty-num").textContent = orderItems[name].qty;
  updateCart();
  showToast(name, "agregado");
  saveCartToStorage();
}

function syncInlineControlForItem(name) {
  document.querySelectorAll(".add-btn").forEach((btn) => {
    const data = getOrderButtonData(btn);
    if (!data || data.name !== name) return;

    const qtyEl = document.getElementById(data.qtyId);
    if (!qtyEl || !orderItems[name]) return;

    btn.style.display = "none";
    qtyEl.classList.add("visible");
    renderInlineQty(qtyEl, name, data.price, btn);
  });
}

function addSpotlightOrder() {
  const spotlightItems = [
    { name: "Huevos Benedictinos", price: 189 },
    { name: "CafÃ© de Olla", price: 55 }
  ];

  spotlightItems.forEach((item) => {
    if (orderItems[item.name]) {
      orderItems[item.name].qty++;
    } else {
      orderItems[item.name] = { name: item.name, price: item.price, qty: 1 };
    }
    syncInlineControlForItem(item.name);
  });

  updateCart();
  bumpBadge();
  saveCartToStorage();
  showToast("Imperdible de hoy", "agregado a tu orden");
  playFeedback("success");
  toggleOrder(true);
}

function updateCart() {
  const keys = Object.keys(orderItems);
  const total = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
  const count = keys.reduce((s, k) => s + orderItems[k].qty, 0);

  document.getElementById("cartBadge").textContent = count;
  document.getElementById("fabBadge").textContent = count;
  document.getElementById("fabAmount").textContent = "$" + total.toLocaleString("es-MX");
  document.getElementById("orderMeterCount").textContent = `${count} item${count !== 1 ? "s" : ""}`;
  document.getElementById("orderMeterTotal").textContent = "$" + total.toLocaleString("es-MX");
  document.getElementById("orderMeta").textContent = count
    ? `${count} item${count !== 1 ? "s" : ""} en tu orden`
    : "Sin platillos agregados";

  const fab = document.getElementById("orderFab");
  fab.classList.toggle("visible", count > 0);

  const container = document.getElementById("orderItems");
  const empty = document.getElementById("orderEmpty");
  const footer = document.getElementById("orderFooter");

  if (keys.length === 0) {
    empty.style.display = "";
    footer.style.display = "none";
    container.querySelectorAll(".order-line").forEach((l) => l.remove());
    return;
  }

  empty.style.display = "none";
  footer.style.display = "";

  container.querySelectorAll(".order-line").forEach((l) => l.remove());
  keys.forEach((k) => {
    const item = orderItems[k];
    const line = document.createElement("div");
    line.className = "order-line";
    line.setAttribute("data-key", k);
    line.innerHTML = `
      <div class="order-line-qty">x${item.qty}</div>
      <div class="order-line-info">
        <div class="order-line-name">${item.name}</div>
        <div class="order-line-price">$${(item.price * item.qty).toLocaleString("es-MX")} · $${item.price} c/u</div>
      </div>
      <div class="order-line-actions">
        <button class="order-qty-btn" onclick="panelQty('${k}',-1)" aria-label="Quitar ${item.name}">−</button>
        <span class="order-qty-num">${item.qty}</span>
        <button class="order-qty-btn" onclick="panelQty('${k}',1)" aria-label="Agregar ${item.name}">+</button>
      </div>
    `;
    container.appendChild(line);
  });

  const sub = document.getElementById("orderSubtotals");
  sub.innerHTML = `
    <div class="order-row"><span>Subtotal (${count} item${count !== 1 ? "s" : ""})</span><span>$${total.toLocaleString("es-MX")}</span></div>
    <div class="order-row"><span>Servicio (10%)</span><span>$${Math.round(total * 0.1).toLocaleString("es-MX")}</span></div>
    <div class="order-row total"><span>Total</span><span>$${Math.round(total * 1.1).toLocaleString("es-MX")}</span></div>
  `;
}

function panelQty(name, delta) {
  if (!orderItems[name]) return;
  orderItems[name].qty += delta;
  playFeedback(delta > 0 ? "add" : "remove");
  const shouldRemove = orderItems[name].qty <= 0;

  document.querySelectorAll(".add-btn").forEach((btn) => {
    const data = getOrderButtonData(btn);
    if (!data || data.name !== name) return;

    const qtyEl = document.getElementById(data.qtyId);
    if (!qtyEl) return;

    if (shouldRemove) {
      qtyEl.classList.remove("visible");
      qtyEl.innerHTML = "";
      btn.style.display = "";
    } else {
      const numEl = qtyEl.querySelector(".qty-num");
      if (numEl) numEl.textContent = orderItems[name].qty;
    }
  });

  if (shouldRemove) delete orderItems[name];
  updateCart();
  showToast(name, delta > 0 ? "agregado" : "actualizado");
  saveCartToStorage();
}
 
// MEJORA: confirmar orden vía WhatsApp
// Version segura para nombres creados desde admin.
function updateCart() {
  const keys = Object.keys(orderItems);
  const total = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
  const count = keys.reduce((s, k) => s + orderItems[k].qty, 0);

  document.getElementById("cartBadge").textContent = count;
  document.getElementById("fabBadge").textContent = count;
  document.getElementById("fabAmount").textContent = "$" + total.toLocaleString("es-MX");
  document.getElementById("orderMeterCount").textContent = `${count} item${count !== 1 ? "s" : ""}`;
  document.getElementById("orderMeterTotal").textContent = "$" + total.toLocaleString("es-MX");
  document.getElementById("orderMeta").textContent = count
    ? `${count} item${count !== 1 ? "s" : ""} en tu orden`
    : "Sin platillos agregados";

  const fab = document.getElementById("orderFab");
  fab.classList.toggle("visible", count > 0);

  const container = document.getElementById("orderItems");
  const empty = document.getElementById("orderEmpty");
  const footer = document.getElementById("orderFooter");

  if (keys.length === 0) {
    empty.style.display = "";
    footer.style.display = "none";
    container.querySelectorAll(".order-line").forEach((line) => line.remove());
    return;
  }

  empty.style.display = "none";
  footer.style.display = "";
  container.querySelectorAll(".order-line").forEach((line) => line.remove());

  keys.forEach((key) => {
    const item = orderItems[key];
    const line = document.createElement("div");
    line.className = "order-line";
    line.dataset.key = key;
    line.innerHTML = `
      <div class="order-line-qty">x${item.qty}</div>
      <div class="order-line-info">
        <div class="order-line-name">${escapeHtml(item.name)}</div>
        <div class="order-line-price">$${(item.price * item.qty).toLocaleString("es-MX")} · $${item.price} c/u</div>
      </div>
      <div class="order-line-actions">
        <button class="order-qty-btn" type="button" data-delta="-1" aria-label="Quitar ${escapeHtml(item.name)}">-</button>
        <span class="order-qty-num">${item.qty}</span>
        <button class="order-qty-btn" type="button" data-delta="1" aria-label="Agregar ${escapeHtml(item.name)}">+</button>
      </div>
    `;
    line.querySelectorAll(".order-qty-btn").forEach((btn) => {
      btn.addEventListener("click", () => panelQty(key, Number(btn.dataset.delta)));
    });
    container.appendChild(line);
  });

  const sub = document.getElementById("orderSubtotals");
  sub.innerHTML = `
    <div class="order-row"><span>Subtotal (${count} item${count !== 1 ? "s" : ""})</span><span>$${total.toLocaleString("es-MX")}</span></div>
    <div class="order-row"><span>Servicio (10%)</span><span>$${Math.round(total * 0.1).toLocaleString("es-MX")}</span></div>
    <div class="order-row total"><span>Total</span><span>$${Math.round(total * 1.1).toLocaleString("es-MX")}</span></div>
  `;
}

function getOrderTotal(items = orderItems) {
  return Object.keys(items).reduce((s, k) => s + items[k].price * items[k].qty, 0);
}

function saveLastOrder(orderNum, items, notes) {
  const snapshot = {
    orderNum,
    items,
    notes,
    subtotal: getOrderTotal(items),
    total: Math.round(getOrderTotal(items) * 1.1),
    createdAt: new Date().toISOString()
  };
  try {
    sessionStorage.setItem("labocata_last_order", JSON.stringify(snapshot));
  } catch (e) {}
  renderLastOrder(snapshot);
}

function renderLastOrder(order = null) {
  const card = document.getElementById("lastOrderCard");
  if (!card) return;

  if (!order) {
    try {
      const saved = sessionStorage.getItem("labocata_last_order");
      order = saved ? JSON.parse(saved) : null;
    } catch (e) {
      order = null;
    }
  }

  if (!order || !order.items || Object.keys(order.items).length === 0) return;

  const count = Object.keys(order.items).reduce((s, k) => s + order.items[k].qty, 0);
  const items = Object.keys(order.items)
    .map((k) => {
      const item = order.items[k];
      return `<li><span>${item.qty}x ${item.name}</span><strong>$${(item.price * item.qty).toLocaleString("es-MX")}</strong></li>`;
    })
    .join("");
  const date = new Date(order.createdAt).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

  card.innerHTML = `
    <span class="last-order-kicker">Orden ${order.orderNum} · ${date}</span>
    <h3>${count} item${count !== 1 ? "s" : ""} guardado${count !== 1 ? "s" : ""}</h3>
    <ul class="last-order-list">${items}</ul>
    <div class="last-order-total">
      <span>Total con servicio</span>
      <strong>$${order.total.toLocaleString("es-MX")}</strong>
    </div>
  `;
}

function repeatLastOrder() {
  try {
    const saved = sessionStorage.getItem("labocata_last_order");
    if (!saved) {
      showToast("Sin pedido previo", "confirma una orden primero");
      return;
    }
    const last = JSON.parse(saved);
    orderItems = JSON.parse(JSON.stringify(last.items || {}));
    document.querySelectorAll(".qty-ctrl").forEach((el) => {
      el.classList.remove("visible");
      el.innerHTML = "";
    });
    document.querySelectorAll(".add-btn").forEach((btn) => {
      btn.style.display = "";
      btn.classList.remove("added");
    });
    saveCartToStorage();
    loadCartFromStorage();
    updateCart();
    toggleOrder(true);
    showToast("Ultimo pedido", "cargado en tu orden");
    playFeedback("success");
  } catch (e) {
    showToast("No se pudo repetir", "intenta de nuevo");
  }
}

function confirmOrder() {
  const keys = Object.keys(orderItems);
  if (keys.length === 0) return;

  const orderNum = "BOC-" + Math.floor(Math.random() * 9000 + 1000);
  const notes = document.getElementById("orderNotes").value;
  const orderSnapshot = JSON.parse(JSON.stringify(orderItems));

  // Construir mensaje para WhatsApp
  let msg = `¡Hola Labocata! 🍳 Quiero hacer un pedido:\n\n`;
  keys.forEach((k) => {
    const item = orderItems[k];
    msg += `• ${item.qty}x ${item.name} — $${(item.price * item.qty).toLocaleString("es-MX")}\n`;
  });
  const total = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
  msg += `\n💰 Total (con servicio): $${Math.round(total * 1.1).toLocaleString("es-MX")}`;
  if (notes) msg += `\n\n📝 Notas: ${notes}`;
  msg += `\n\n#${orderNum}`;

  const waUrl = `https://wa.me/529210000000?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, "_blank");
  saveLastOrder(orderNum, orderSnapshot, notes);
  playFeedback("success");

  document.getElementById("orderNum").textContent = "Orden #" + orderNum;
  document.getElementById("orderContent").style.display = "none";
  document.getElementById("orderSuccess").classList.add("show");
}

function resetOrder() {
  orderItems = {};
  saveCartToStorage();
  document.getElementById("orderContent").style.display = "flex";
  document.getElementById("orderSuccess").classList.remove("show");
  document.querySelectorAll(".qty-ctrl").forEach((el) => {
    el.classList.remove("visible");
    el.innerHTML = "";
  });
  document.querySelectorAll(".add-btn").forEach((btn) => {
    btn.style.display = "";
    btn.classList.remove("added");
  });
  document.getElementById("orderNotes").value = "";
  updateCart();
  toggleOrder(false);
}

function bumpBadge() {
  const badge = document.getElementById("cartBadge");
  badge.classList.remove("bump");
  void badge.offsetWidth;
  badge.classList.add("bump");
}

// ===== ORDER TYPE (pickup / delivery) =====
function setOrderType(type) {
  const btnPickup = document.getElementById("btnPickup");
  const btnDelivery = document.getElementById("btnDelivery");
  const pickupInfo = document.getElementById("pickupInfo");
  const deliveryFields = document.getElementById("deliveryFields");

  if (type === "pickup") {
    btnPickup.classList.add("active");
    btnDelivery.classList.remove("active");
    pickupInfo.classList.add("show");
    deliveryFields.classList.remove("show");
  } else {
    btnDelivery.classList.add("active");
    btnPickup.classList.remove("active");
    deliveryFields.classList.add("show");
    pickupInfo.classList.remove("show");
  }
}

// ===== REVEAL ON SCROLL =====
const revealEls = document.querySelectorAll(".reveal");
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("visible");
    });
  },
  { threshold: 0.08 }
);
revealEls.forEach((el) => revealObs.observe(el));

// ===== ANIMATE CARDS =====
const cardObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => {
          e.target.style.opacity = "1";
          e.target.style.transform = "translateY(0)";
        }, (i % 4) * 60);
        cardObs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.06 }
);

function prepareCardAnimation(el) {
  el.style.opacity = "0";
  el.style.transform = "translateY(16px)";
  el.style.transition = "opacity 0.6s, transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94)";
  cardObs.observe(el);
}

document.querySelectorAll(".menu-item").forEach(prepareCardAnimation);

// Version segura para nombres agregados desde admin.
function renderInlineQty(el, name, price, addBtn) {
  const qty = orderItems[name] ? orderItems[name].qty : 0;
  el.innerHTML = "";

  const minus = document.createElement("button");
  minus.className = "qty-btn";
  minus.type = "button";
  minus.textContent = "-";
  minus.addEventListener("click", () => changeInlineQty(minus, name, price, el.id, addBtn));

  const num = document.createElement("span");
  num.className = "qty-num";
  num.textContent = qty;

  const plus = document.createElement("button");
  plus.className = "qty-btn";
  plus.type = "button";
  plus.textContent = "+";
  plus.addEventListener("click", () => addInlineQty(name, el.id));

  el.append(minus, num, plus);
}

// Close panel on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && orderOpen) toggleOrder(false);
});

// MEJORA: cargar carrito guardado al iniciar
document.addEventListener("DOMContentLoaded", async () => {
  await setupDynamicMenuCatalogs();
  await renderCustomDishes();
  setupAdminPanel();
  loadCartFromStorage();
  renderLastOrder();
});
