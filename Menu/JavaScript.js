// ===== NAV SCROLL =====
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  if (nav) nav.classList.toggle("scrolled", window.scrollY > 60);
});

// ===== FILTER — Platillos =====
let filterBtns = document.querySelectorAll(".filter-btn");
let catHeaders = document.querySelectorAll(".cat-header:not(.bebidas-subheader)");
let menuGrids = document.querySelectorAll(".menu-grid:not(.bebidas-grid)");
const bebidasSection = document.querySelector(".bebidas-section");
const bebidasFilterBar = document.getElementById("bebidasFilterBar");
const bebidasGridsEl = document.getElementById("bebidasGrids");

function setBebidasVisible(show) {
  const val = show ? "" : "none";
  if (bebidasSection) bebidasSection.style.display = val;
  if (bebidasFilterBar) bebidasFilterBar.style.display = val;
  if (bebidasGridsEl) bebidasGridsEl.style.display = val;
}

function applyMenuFilter(btn) {
  filterBtns.forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const f = btn.dataset.filter;

  catHeaders.forEach((h) => (h.style.display = ""));
  menuGrids.forEach((g) => (g.style.display = ""));
  document.querySelectorAll(".menu-item").forEach((i) => (i.style.display = ""));
  setBebidasVisible(true);

  if (f === "all") return;

  catHeaders.forEach((h) => (h.style.display = h.dataset.cat === f ? "" : "none"));
  menuGrids.forEach((g) => (g.style.display = g.dataset.cat === f ? "" : "none"));
  document.querySelectorAll("#menuBody .menu-item").forEach(item => {
    if (item.dataset.cat !== f) item.style.display = "none";
  });

  setTimeout(() => {
    const first = document.querySelector(`.cat-header:not(.bebidas-subheader)[data-cat="${f}"]`);
    if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

// ===== FILTER — Bebidas =====
function applyDrinkFilter(btn) {
  document.querySelectorAll(".bebidas-filter-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const f = btn.dataset.drinkFilter;

  document.querySelectorAll(".bebidas-subheader").forEach(h => h.style.display = "");
  document.querySelectorAll(".bebidas-grid").forEach((grid) => {
    const show = (f === "todas" || grid.dataset.drinkCat === f);
    grid.style.display = show ? "" : "none";
    const header = grid.previousElementSibling;
    if (header && header.classList.contains('bebidas-subheader')) {
      header.style.display = show ? "" : "none";
    }
  });
}

// ===== HELPERS =====
const defaultMenuTags = [
  { id: "v", label: "Vegetariano" },
  { id: "vg", label: "Vegano" },
  { id: "gf", label: "Sin gluten" },
  { id: "s", label: "Signature" },
  { id: "nuevo", label: "Nuevo" }
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

// Strip HTML tags for plain text use (e.g. order names, aria labels)
function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, "").trim();
}

// ===== DATA FETCHING =====
async function fetchProducts() {
  try {
    const { data, error } = await window.supabaseClient.from('products').select('*');
    if (error) throw error;
    return data || [];
  } catch (e) { console.error("Error fetching products:", e); return []; }
}

async function fetchCategories() {
  try {
    const { data, error } = await window.supabaseClient.from('categories').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) { console.error("Error fetching categories:", e); return []; }
}

let currentMenuTags = defaultMenuTags;
let currentWeeklyCombos = {};
let currentCategoryMetadata = {};
let currentCategories = [];

function getTagLabels() {
  return currentMenuTags.reduce((map, tag) => { map[tag.id] = tag.label; return map; }, {});
}

function renderTagSpans(tags = []) {
  const tagLabels = getTagLabels();
  return (tags || [])
    .map((tag) => {
      const label = tagLabels[tag] || tag;
      const className = currentMenuTags.some((item) => item.id === tag) ? tag : "custom";
      return `<span class="item-tag ${className}">${escapeHtml(label)}</span>`;
    })
    .join("");
}

function parseVariants(product) {
  const description = product.description;
  try {
    if (description && description.startsWith('{')) {
      const data = JSON.parse(description);
      return {
        desc: data.main_description || "",
        variants: data.variants || [],
        tipo_bebida: data.tipo_bebida || null,
        special_price: data.special_price || null,
        tags: data.tags || [],
        visual_style: data.visual_style || "auto",
        featured_text: data.featured_text || null
      };
    }
  } catch (e) {}
  return { desc: description || "", variants: [], tipo_bebida: null, special_price: null, tags: [], visual_style: "auto", featured_text: null };
}

function renderProductCard(product) {
  const { desc, variants, special_price, tags, visual_style, featured_text } = parseVariants(product);
  const qtyId = `qty-prod-${product.id}`;
  const hasImage = Boolean(product.image_url);
  const isFeatured = product.featured;

  // Plain name for order/aria use (no HTML tags)
  const plainName = stripHtml(product.name);

  let styleClass = "reveal text-card";
  if (visual_style === "featured") styleClass = "reveal featured";
  else if (visual_style === "photo") styleClass = "reveal has-photo";
  else if (visual_style === "text") styleClass = "reveal text-card";
  else {
    if (isFeatured) styleClass = "reveal featured";
    else if (hasImage) styleClass = "reveal has-photo";
  }

  const card = document.createElement("div");
  card.className = `menu-item ${styleClass}`;
  card.id = `prod-${product.id}`;
  card.dataset.cat = product.category_id;
  card.dataset.tags = tags.join(',');

  let variantHtml = "";
  if (variants.length > 0) {
    variantHtml = `<div class="item-variants">` + variants.map((v, i) => `
      <button class="variant-btn ${i===0?'active':''}" 
        data-variant-name="${escapeHtml(v.name)}" 
        data-variant-price="${v.price}"
        onclick="selectVariant(this)">
        ${escapeHtml(v.name)} ($${v.price})
      </button>
    `).join("") + `</div>`;
  }

  let displayPrice = special_price || product.price;
  // Use plain name for order purposes
  let initialOrderName = variants.length > 0
    ? `${plainName} (${variants[0].name})`
    : plainName;

  if (variants.length > 0) {
    displayPrice = variants[0].price || 0;
  }

  const originalPriceHtml = (special_price && Number(product.price))
    ? `<span class="old-price">$${Number(product.price).toLocaleString("es-MX")}</span>`
    : "";

  card.innerHTML = `
    ${(styleClass !== 'text-card' && hasImage)
      ? `<div class="item-photo"><img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(plainName)}" loading="lazy" /></div>`
      : ""}
    <div class="item-body">
      ${isFeatured ? `<span class="featured-badge">✦ &nbsp;${escapeHtml(featured_text || "Recomendado")}</span>` : ""}
      <div class="item-header">
        <h3 class="item-name">${product.name}</h3>
        <div class="price-wrapper">
          ${originalPriceHtml}
          <span class="item-price ${special_price ? 'special' : ''}" id="price-${product.id}">$${Number(displayPrice).toLocaleString("es-MX")}</span>
        </div>
      </div>
      <p class="item-desc">${escapeHtml(desc)}</p>
      ${variantHtml}
      <div class="item-footer">
        <div class="item-tags">${renderTagSpans(tags)}</div>
        <div class="qty-ctrl" id="${qtyId}"></div>
        <button class="add-btn" type="button" id="add-btn-${product.id}"
                data-item-name="${escapeHtml(initialOrderName)}"
                data-item-price="${displayPrice}"
                data-qty-id="${qtyId}">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Agregar
        </button>
      </div>
    </div>
  `;

  // Bind click via addEventListener (not inline onclick) to avoid name escaping issues
  const addBtn = card.querySelector('.add-btn');
  addBtn.addEventListener('click', function() {
    addToOrder(this, this.dataset.itemName, parseFloat(this.dataset.itemPrice), this.dataset.qtyId);
  });

  return card;
}

window.selectVariant = (btn) => {
  const container = btn.closest('.item-variants');
  container.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const name = btn.dataset.variantName;
  const price = parseFloat(btn.dataset.variantPrice);

  const card = btn.closest('.menu-item');
  card.querySelector('.item-price').textContent = `$${Number(price).toLocaleString("es-MX")}`;

  // Update the add button's data attributes
  const addBtn = card.querySelector('.add-btn');
  const baseName = stripHtml(card.querySelector('.item-name').innerHTML);
  const newName = `${baseName} (${name})`;
  addBtn.dataset.itemName = newName;
  addBtn.dataset.itemPrice = price;
};

async function renderMenu() {
  const container = document.getElementById("menu-categories-container");
  const bebidasGrids = document.getElementById("bebidasGrids");
  if (!container) return;

  let [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);
  currentCategories = categories;

  const tagsRecord = products.find(p => p.name === '___SYSTEM_TAGS___');
  if (tagsRecord) {
    try {
      const config = JSON.parse(tagsRecord.description);
      currentMenuTags = config.tags || defaultMenuTags;
      currentWeeklyCombos = config.weeklyCombos || {};
      currentCategoryMetadata = config.categoryMetadata || {};
      const orderedIds = config.orderedCategoryIds || [];
      if (orderedIds.length > 0) {
        categories.sort((a, b) => {
          const idxA = orderedIds.indexOf(a.id);
          const idxB = orderedIds.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }
    } catch (e) { console.error("Error parsing system tags", e); }
  }

  // Update Filter Nav
  const filterInner = document.querySelector(".filter-inner");
  if (filterInner) {
    filterInner.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className = "filter-btn active";
    allBtn.dataset.filter = "all";
    allBtn.textContent = "Todo el menú";
    allBtn.onclick = () => applyMenuFilter(allBtn);
    filterInner.appendChild(allBtn);

    const divAll = document.createElement("div");
    divAll.className = "filter-divider";
    filterInner.appendChild(divAll);

    categories.forEach(cat => {
      if (cat.name.toLowerCase().includes('bebida')) return;
      const btn = document.createElement("button");
      btn.className = "filter-btn";
      btn.dataset.filter = cat.id;
      btn.textContent = cat.name;
      btn.onclick = () => applyMenuFilter(btn);
      filterInner.appendChild(btn);
      const div = document.createElement("div");
      div.className = "filter-divider";
      filterInner.appendChild(div);
    });

    const dietary = document.createElement("div");
    dietary.className = "filter-dietary";
    dietary.innerHTML = currentMenuTags.map(t => `
      <span class="dietary-tag"><span class="diet-dot ${t.id}"></span>${t.label}</span>
    `).join('');
    filterInner.appendChild(dietary);
  }

  container.innerHTML = "";
  if (bebidasGrids) bebidasGrids.innerHTML = "";

  categories.forEach((cat, idx) => {
    const isBebidas = cat.name.toLowerCase().includes('bebida');
    const catProducts = products.filter(p => p.category_id === cat.id && p.name !== '___SYSTEM_TAGS___');

    if (isBebidas) {
      const types = [
        { id: 'caliente', label: 'Calientes' },
        { id: 'fria', label: 'Frías' },
        { id: 'jugo', label: 'Jugos & Licuados' }
      ];
      types.forEach(type => {
        const typeProducts = catProducts.filter(p => {
          const { tipo_bebida } = parseVariants(p);
          return tipo_bebida === type.id;
        });
        if (typeProducts.length > 0) {
          const header = document.createElement("div");
          header.className = "cat-header bebidas-subheader reveal";
          header.innerHTML = `<div><span class="cat-num">Bebidas</span><h2 class="cat-title">${type.label}</h2></div>`;
          bebidasGrids.appendChild(header);
          const grid = document.createElement("div");
          grid.className = "menu-grid bebidas-grid";
          grid.dataset.drinkCat = type.id;
          typeProducts.forEach((p, pIdx) => {
            const card = renderProductCard(p);
            if (pIdx % 5 > 0) card.classList.add(`reveal-delay-${pIdx % 5}`);
            grid.appendChild(card);
          });
          bebidasGrids.appendChild(grid);
        }
      });
      const other = catProducts.filter(p => !parseVariants(p).tipo_bebida);
      if (other.length > 0) {
        const header = document.createElement("div");
        header.className = "cat-header bebidas-subheader reveal";
        header.innerHTML = `<div><span class="cat-num">Bebidas</span><h2 class="cat-title">Otras</h2></div>`;
        bebidasGrids.appendChild(header);
        const grid = document.createElement("div");
        grid.className = "menu-grid bebidas-grid";
        grid.dataset.drinkCat = "todas";
        other.forEach((p, pIdx) => {
          const card = renderProductCard(p);
          if (pIdx % 5 > 0) card.classList.add(`reveal-delay-${pIdx % 5}`);
          grid.appendChild(card);
        });
        bebidasGrids.appendChild(grid);
      }
    } else {
      const meta = currentCategoryMetadata[cat.id] || { title: cat.name, description: "" };
      const header = document.createElement("div");
      header.className = "cat-header reveal";
      header.dataset.cat = cat.id;
      header.innerHTML = `
        <div>
          <span class="cat-num">0${idx + 1} — ${escapeHtml(cat.name)}</span>
          <h2 class="cat-title">${meta.title}</h2>
        </div>
        ${meta.description ? `<p class="cat-desc">${escapeHtml(meta.description)}</p>` : ''}
      `;
      const grid = document.createElement("div");
      grid.className = "menu-grid";
      grid.dataset.cat = cat.id;
      catProducts.forEach((p, pIdx) => {
        const card = renderProductCard(p);
        if (pIdx % 5 > 0) card.classList.add(`reveal-delay-${pIdx % 5}`);
        grid.appendChild(card);
      });
      container.appendChild(header);
      container.appendChild(grid);
    }
  });

  // Spotlight
  const today = new Date().getDay();
  const combo = currentWeeklyCombos[today];
  const spotlightSection = document.querySelector(".menu-spotlight");

  if (combo && combo.title) {
    spotlightSection.style.display = "grid";
    document.getElementById("spotlightTitle").innerHTML = combo.title;
    document.getElementById("spotlightDescription").textContent = combo.subtitle;
    document.getElementById("spotlightTotal").textContent = `$${Number(combo.price).toLocaleString("es-MX")}`;

    const p1 = products.find(p => p.id === combo.dish1);
    if (p1 && p1.image_url) document.getElementById("spotlightImageOne").src = p1.image_url;

    const actionBtn = spotlightSection.querySelector(".spotlight-btn.primary");
    actionBtn.textContent = "Agregar Combo";
    actionBtn.onclick = () => addToOrder(actionBtn, stripHtml(combo.title), combo.price, 'spotlight-qty');
  } else {
    const spotlightProd = products.find(p =>
      p.featured && !categories.find(c => c.id === p.category_id)?.name.toLowerCase().includes('bebida')
    );
    if (spotlightProd && spotlightSection) {
      spotlightSection.style.display = "grid";
      const { desc, special_price } = parseVariants(spotlightProd);
      const displayPrice = special_price || spotlightProd.price;
      document.getElementById("spotlightTitle").innerHTML = spotlightProd.name;
      document.getElementById("spotlightDescription").textContent = desc;
      document.getElementById("spotlightTotal").textContent = `$${Number(displayPrice).toLocaleString("es-MX")}`;
      if (spotlightProd.image_url) document.getElementById("spotlightImageOne").src = spotlightProd.image_url;

      const actionBtn = spotlightSection.querySelector(".spotlight-btn.primary");
      actionBtn.textContent = "Agregar Platillo";
      actionBtn.onclick = () => addToOrder(actionBtn, stripHtml(spotlightProd.name), displayPrice, 'spotlight-qty');
    } else if (spotlightSection) {
      spotlightSection.style.display = "none";
    }
  }

  filterBtns = document.querySelectorAll(".filter-btn");
  catHeaders = document.querySelectorAll(".cat-header");
  menuGrids = document.querySelectorAll(".menu-grid");

  // Re-observe reveals
  document.querySelectorAll(".reveal").forEach(el => revealObs.observe(el));

  // Restore cart state after menu renders
  restoreCartUI();
}

// ===== PREVIEW MESSAGE LISTENER =====
window.addEventListener('message', (event) => {
  if (event.data.type === 'PREVIEW_UPDATE') previewProduct(event.data.product);
});

function previewProduct(product) {
  const cardId = `prod-${product.id}`;
  const existing = document.getElementById(cardId);
  const newCard = renderProductCard(product);

  newCard.classList.add('visible');
  newCard.style.transition = "none";
  newCard.style.opacity = "1";
  newCard.style.transform = "translateY(0)";

  if (existing) {
    if (existing.dataset.cat !== product.category_id) {
      existing.remove();
      insertProductInGrid(newCard, product);
    } else {
      existing.replaceWith(newCard);
    }
  } else {
    insertProductInGrid(newCard, product);
  }

  newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function insertProductInGrid(card, product) {
  const cat = currentCategories.find(c => c.id === product.category_id);
  const isBebida = cat && cat.name.toLowerCase().includes('bebida');
  const { tipo_bebida } = parseVariants(product);

  let grid;
  if (isBebida) {
    const drinkCat = tipo_bebida || "todas";
    grid = document.querySelector(`.bebidas-grid[data-drink-cat="${drinkCat}"]`);
  } else {
    grid = document.querySelector(`.menu-grid[data-cat="${product.category_id}"]`);
  }

  if (grid) {
    grid.prepend(card);
    grid.style.display = "";
    if (isBebida) setBebidasVisible(true);
  } else {
    const container = document.getElementById("menu-categories-container");
    if (container) container.prepend(card);
  }
}

// ===== SOUND EFFECTS =====
const addSound = new Audio("Sounds/Click.mp3");
let audioCtx;
function playTone(kind = "add") {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const tones = { add: [640, 880], remove: [300, 210], open: [420, 540], success: [520, 720, 980] }[kind] || [520];
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
// Key: plain item name (no HTML). Value: { name, price, qty }
let orderItems = {};
let orderOpen = false;

function saveCartToStorage() {
  try {
    sessionStorage.setItem("labocata_cart", JSON.stringify(orderItems));
  } catch (e) {}
}

function loadCartFromStorage() {
  try {
    const saved = sessionStorage.getItem("labocata_cart");
    if (saved) {
      orderItems = JSON.parse(saved);
      updateCart();
    }
  } catch (e) {
    orderItems = {};
  }
}

/**
 * After menu renders, reconnect qty controls for any items
 * already in the cart (handles page reload scenario).
 */
function restoreCartUI() {
  const names = Object.keys(orderItems);
  if (names.length === 0) return;

  document.querySelectorAll(".add-btn").forEach((btn) => {
    const itemName = btn.dataset.itemName;
    if (!itemName || !orderItems[itemName]) return;

    const qtyId = btn.dataset.qtyId;
    const qtyEl = document.getElementById(qtyId);
    if (!qtyEl) return;

    btn.style.display = "none";
    qtyEl.classList.add("visible");
    renderInlineQty(qtyEl, itemName, orderItems[itemName].price);
  });
}

function toggleOrder(open) {
  orderOpen = open;
  document.getElementById("orderPanel").classList.toggle("open", open);
  document.getElementById("orderOverlay").classList.toggle("open", open);
  document.body.style.overflow = open ? "hidden" : "";
  if (open) playFeedback("open");
}

function showToast(name, action = "agregado") {
  let toast = document.getElementById("globalToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.id = "globalToast";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${action}</span>`;
  toast.classList.add("show");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove("show"), 2200);
}

function addToOrder(btn, name, price, qtyId) {
  // name should already be plain text (no HTML)
  name = stripHtml(name);
  price = parseFloat(price);

  playFeedback("add");
  if (navigator.vibrate) navigator.vibrate(30);

  if (orderItems[name]) {
    orderItems[name].qty++;
  } else {
    orderItems[name] = { name, price, qty: 1 };
  }

  const qtyEl = document.getElementById(qtyId);
  if (qtyEl) {
    btn.style.display = "none";
    qtyEl.classList.add("visible");
    renderInlineQty(qtyEl, name, price);
  }

  updateCart();
  bumpBadge();
  showToast(name);
  saveCartToStorage();
}

function renderInlineQty(el, name, price) {
  const qty = orderItems[name] ? orderItems[name].qty : 0;
  el.innerHTML = "";

  const m = document.createElement("button");
  m.className = "qty-btn";
  m.textContent = "−";
  m.addEventListener('click', () => changeQty(name, -1, el.id));

  const n = document.createElement("span");
  n.className = "qty-num";
  n.textContent = qty;

  const p = document.createElement("button");
  p.className = "qty-btn";
  p.textContent = "+";
  p.addEventListener('click', () => changeQty(name, 1, el.id));

  el.append(m, n, p);
}

window.changeQty = (name, delta, qtyId) => {
  if (!orderItems[name]) return;

  orderItems[name].qty += delta;
  playFeedback(delta > 0 ? "add" : "remove");

  if (orderItems[name].qty <= 0) {
    delete orderItems[name];
    const el = document.getElementById(qtyId);
    if (el) {
      el.classList.remove("visible");
      el.innerHTML = "";
      // Show the add button again
      const card = el.closest('.menu-item, .bebida-item');
      if (card) {
        const addBtn = card.querySelector('.add-btn');
        if (addBtn) addBtn.style.display = "";
      }
    }
  } else {
    const el = document.getElementById(qtyId);
    if (el) renderInlineQty(el, name, orderItems[name].price);
  }

  updateCart();
  saveCartToStorage();
};

function updateCart() {
  const keys = Object.keys(orderItems);
  const total = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
  const count = keys.reduce((s, k) => s + orderItems[k].qty, 0);

  // Update badge counts
  const cartBadge = document.getElementById("cartBadge");
  const fabBadge = document.getElementById("fabBadge");
  if (cartBadge) cartBadge.textContent = count;
  if (fabBadge) fabBadge.textContent = count;

  const fabAmount = document.getElementById("fabAmount");
  if (fabAmount) fabAmount.textContent = "$" + total.toLocaleString("es-MX");

  const orderMeterCount = document.getElementById("orderMeterCount");
  if (orderMeterCount) orderMeterCount.textContent = `${count} item${count !== 1 ? "s" : ""}`;

  const orderMeterTotal = document.getElementById("orderMeterTotal");
  if (orderMeterTotal) orderMeterTotal.textContent = "$" + total.toLocaleString("es-MX");

  const orderMeta = document.getElementById("orderMeta");
  if (orderMeta) orderMeta.textContent = count
    ? `${count} item${count !== 1 ? "s" : ""} en tu orden`
    : "Sin platillos agregados";

  const orderFab = document.getElementById("orderFab");
  if (orderFab) orderFab.classList.toggle("visible", count > 0);

  const container = document.getElementById("orderItems");
  const empty = document.getElementById("orderEmpty");
  const footer = document.getElementById("orderFooter");

  if (!container) return;

  if (keys.length === 0) {
    if (empty) empty.style.display = "";
    if (footer) footer.style.display = "none";
    container.innerHTML = "";
    return;
  }

  if (empty) empty.style.display = "none";
  if (footer) footer.style.display = "";

  container.innerHTML = "";
  keys.forEach((key) => {
    const item = orderItems[key];
    const line = document.createElement("div");
    line.className = "order-line";
    line.innerHTML = `
      <div class="order-line-qty">x${item.qty}</div>
      <div class="order-line-info">
        <div class="order-line-name">${escapeHtml(item.name)}</div>
        <div class="order-line-price">$${(item.price * item.qty).toLocaleString("es-MX")} · $${item.price} c/u</div>
        <div class="order-line-actions">
          <button class="order-qty-btn" data-name="${escapeHtml(key)}" data-delta="-1">−</button>
          <span class="order-qty-num">${item.qty}</span>
          <button class="order-qty-btn" data-name="${escapeHtml(key)}" data-delta="1">+</button>
        </div>
      </div>
    `;

    // Use data attributes + event listeners instead of inline onclick
    line.querySelectorAll('.order-qty-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        panelQty(this.dataset.name, parseInt(this.dataset.delta));
      });
    });

    container.appendChild(line);
  });

  const sub = document.getElementById("orderSubtotals");
  if (sub) {
    sub.innerHTML = `
      <div class="order-row"><span>Subtotal</span><span>$${total.toLocaleString("es-MX")}</span></div>
      <div class="order-row"><span>Servicio (10%)</span><span>$${Math.round(total * 0.1).toLocaleString("es-MX")}</span></div>
      <div class="order-row total"><span>Total</span><span>$${Math.round(total * 1.1).toLocaleString("es-MX")}</span></div>
    `;
  }
}

window.panelQty = (name, delta) => {
  if (!orderItems[name]) return;

  orderItems[name].qty += delta;
  playFeedback(delta > 0 ? "add" : "remove");

  if (orderItems[name].qty <= 0) {
    delete orderItems[name];
    // Restore the add button in the menu card if visible
    restoreAddButton(name);
  } else {
    // Update the inline qty control if the card is visible
    document.querySelectorAll(".add-btn").forEach(btn => {
      if (btn.dataset.itemName === name) {
        const qtyId = btn.dataset.qtyId;
        const qtyEl = document.getElementById(qtyId);
        if (qtyEl && qtyEl.classList.contains('visible')) {
          renderInlineQty(qtyEl, name, orderItems[name].price);
        }
      }
    });
  }

  updateCart();
  saveCartToStorage();
};

/**
 * When an item is fully removed from the cart (qty → 0),
 * restore the "+ Agregar" button on the corresponding menu card.
 */
function restoreAddButton(itemName) {
  document.querySelectorAll(".add-btn").forEach(btn => {
    if (btn.dataset.itemName === itemName) {
      const qtyId = btn.dataset.qtyId;
      const qtyEl = document.getElementById(qtyId);
      if (qtyEl) {
        qtyEl.classList.remove("visible");
        qtyEl.innerHTML = "";
      }
      btn.style.display = "";
    }
  });
}

// ===== LAST ORDER =====
function saveLastOrder(orderNum, items, notes) {
  const keys = Object.keys(items);
  const snapshot = {
    orderNum,
    items,
    notes,
    total: Math.round(keys.reduce((s, k) => s + items[k].price * items[k].qty, 0) * 1.1),
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
    } catch (e) {}
  }
  if (!order || !order.items || Object.keys(order.items).length === 0) return;

  const count = Object.keys(order.items).reduce((s, k) => s + order.items[k].qty, 0);
  const items = Object.keys(order.items)
    .map((k) => `<li><span>${order.items[k].qty}x ${escapeHtml(order.items[k].name)}</span><strong>$${(order.items[k].price * order.items[k].qty).toLocaleString("es-MX")}</strong></li>`)
    .join("");
  const date = new Date(order.createdAt).toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
  });
  card.innerHTML = `
    <span class="last-order-kicker">Orden ${order.orderNum} · ${date}</span>
    <h3>${count} item${count !== 1 ? "s" : ""} guardado${count !== 1 ? "s" : ""}</h3>
    <ul class="last-order-list">${items}</ul>
    <div class="last-order-total"><span>Total con servicio</span><strong>$${order.total.toLocaleString("es-MX")}</strong></div>
  `;
}

function repeatLastOrder() {
  try {
    const saved = sessionStorage.getItem("labocata_last_order");
    if (!saved) { showToast("Sin pedido previo"); return; }
    const last = JSON.parse(saved);
    // Clear current cart first
    clearCartUI();
    orderItems = JSON.parse(JSON.stringify(last.items || {}));
    saveCartToStorage();
    updateCart();
    restoreCartUI();
    toggleOrder(true);
    playFeedback("success");
  } catch (e) {
    console.error("repeatLastOrder error:", e);
  }
}

/** Clears all qty controls and shows add buttons (UI reset without clearing orderItems) */
function clearCartUI() {
  document.querySelectorAll(".qty-ctrl").forEach((el) => {
    el.classList.remove("visible");
    el.innerHTML = "";
  });
  document.querySelectorAll(".add-btn").forEach((btn) => {
    btn.style.display = "";
  });
}

// ===== CONFIRM ORDER (WhatsApp) =====
window.confirmOrder = async () => {
  const keys = Object.keys(orderItems);
  if (keys.length === 0) return;

  const confirmBtn = document.getElementById("confirmBtn");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Enviando…";
  }

  const orderNum = "BOC-" + Math.floor(Math.random() * 9000 + 1000);
  const notes = document.getElementById("orderNotes")?.value || "";
  const orderType = document.getElementById("btnDelivery")?.classList.contains("active") ? "delivery" : "pickup";
  const customerName = document.getElementById("deliveryName")?.value || "";
  const customerPhone = document.getElementById("deliveryPhone")?.value || "";
  const deliveryAddress = document.getElementById("deliveryAddress")?.value || "";

  const orderSnapshot = JSON.parse(JSON.stringify(orderItems));

  // Try saving to Supabase
  if (window.LBOrderService) {
    try {
      const result = await window.LBOrderService.submitOrder({
        orderItems: orderSnapshot,
        orderNumber: orderNum,
        notes,
        orderType,
        customerName,
        customerPhone,
        deliveryAddress,
      });

      if (!result.success && result.error && result.error.includes("Demasiados pedidos")) {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
            </svg>
            Confirmar por WhatsApp`;
        }
        showToast(result.error, "error");
        return;
      }
    } catch (e) {
      console.error("[confirmOrder] Supabase exception:", e);
    }
  }

  // Build WhatsApp message
  let msg = `¡Hola Labocata! 🍳 Pedido:\n\n`;
  keys.forEach((k) => {
    msg += `• ${orderItems[k].qty}x ${orderItems[k].name} — $${(orderItems[k].price * orderItems[k].qty).toLocaleString("es-MX")}\n`;
  });
  const total = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
  msg += `\n💰 Total (con servicio): $${Math.round(total * 1.1).toLocaleString("es-MX")}`;
  if (notes) msg += `\n📝 Notas: ${notes}`;
  msg += `\n\n#${orderNum}`;

  window.open(`https://wa.me/529210000000?text=${encodeURIComponent(msg)}`, "_blank");
  saveLastOrder(orderNum, orderSnapshot, notes);
  playFeedback("success");

  // Show success state
  document.getElementById("orderNum").textContent = "Orden #" + orderNum;
  document.getElementById("orderContent").style.display = "none";
  document.getElementById("orderSuccess").classList.add("show");

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
      </svg>
      Confirmar por WhatsApp`;
  }
};

// ===== RESET ORDER — Nueva orden =====
window.resetOrder = () => {
  // Clear state
  orderItems = {};
  saveCartToStorage();

  // Clear UI controls
  clearCartUI();

  // Reset notes and order type UI
  const orderNotes = document.getElementById("orderNotes");
  if (orderNotes) orderNotes.value = "";

  // Restore order content panel (fix: set all required styles)
  const orderContent = document.getElementById("orderContent");
  if (orderContent) {
    orderContent.style.display = "flex";
    orderContent.style.flexDirection = "column";
    orderContent.style.flex = "1";
    orderContent.style.overflow = "hidden";
  }

  // Hide success state
  const orderSuccess = document.getElementById("orderSuccess");
  if (orderSuccess) orderSuccess.classList.remove("show");

  // Reset to pickup
  setOrderType('pickup');

  // Update cart display
  updateCart();

  // Close the panel
  toggleOrder(false);
};

function bumpBadge() {
  const badge = document.getElementById("cartBadge");
  if (badge) {
    badge.classList.remove("bump");
    void badge.offsetWidth;
    badge.classList.add("bump");
  }
}

window.setOrderType = (type) => {
  const btnPickup = document.getElementById("btnPickup");
  const btnDelivery = document.getElementById("btnDelivery");
  const pickupInfo = document.getElementById("pickupInfo");
  const deliveryFields = document.getElementById("deliveryFields");

  if (type === "pickup") {
    if (btnPickup) btnPickup.classList.add("active");
    if (btnDelivery) btnDelivery.classList.remove("active");
    if (pickupInfo) pickupInfo.classList.add("show");
    if (deliveryFields) deliveryFields.classList.remove("show");
  } else {
    if (btnDelivery) btnDelivery.classList.add("active");
    if (btnPickup) btnPickup.classList.remove("active");
    if (deliveryFields) deliveryFields.classList.add("show");
    if (pickupInfo) pickupInfo.classList.remove("show");
  }
};

// Spotlight order helper
window.addSpotlightOrder = () => {
  const spotlightSection = document.querySelector(".menu-spotlight");
  const primaryBtn = spotlightSection?.querySelector(".spotlight-btn.primary");
  if (primaryBtn && primaryBtn.onclick) primaryBtn.onclick();
};

// ===== ANIMATIONS =====
const revealObs = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
  { threshold: 0.15 }
);

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  if (window.self !== window.top) document.body.classList.add('is-preview');

  // Load cart from storage first so updateCart() has data
  loadCartFromStorage();

  // Render menu (will call restoreCartUI after render)
  await renderMenu();

  // Render last order summary
  renderLastOrder();
});
