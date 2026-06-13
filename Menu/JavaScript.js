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
    setTimeout(() => { if(bebidasSection) bebidasSection.scrollIntoView({ behavior: "smooth", block: "start" }) }, 50);
    return;
  }

  // Handle dynamic tags
  const isTag = currentMenuTags.some(t => t.id === f) || f === "vegano";
  if (isTag) {
    catHeaders.forEach((h) => (h.style.display = ""));
    menuGrids.forEach((g) => (g.style.display = ""));
    document.querySelectorAll("#menuBody .menu-item").forEach((item) => {
      const tags = (item.dataset.tags || "").split(',');
      const show = tags.includes(f) || (f === "vegano" && tags.includes("vg"));
      item.style.display = show ? "" : "none";
    });
    setBebidasVisible(false);
    syncVisibleCategorySections();
    return;
  }

  catHeaders.forEach((h) => (h.style.display = h.dataset.cat === f ? "" : "none"));
  menuGrids.forEach((g) => (g.style.display = g.dataset.cat === f ? "" : "none"));
  setBebidasVisible(false);
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

// ===== DATA FETCHING =====
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
let currentSpotlightManualConfig = { active: false, productId: "", price: "" };

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
        visual_style: data.visual_style || "auto"
      };
    }
  } catch (e) {}
  return { desc: description || "", variants: [], tipo_bebida: null, special_price: null, tags: [], visual_style: "auto" };
}

function renderProductCard(product) {
  const { desc, variants, special_price, tags, visual_style } = parseVariants(product);
  const qtyId = `qty-prod-${product.id}`;
  const hasImage = Boolean(product.image_url);
  const isFeatured = product.featured;

  // Determine actual style
  let styleClass = "text-card";
  if (visual_style === "featured") styleClass = "featured";
  else if (visual_style === "photo") styleClass = "has-photo";
  else if (visual_style === "text") styleClass = "text-card";
  else {
    // Auto
    if (isFeatured) styleClass = "featured";
    else if (hasImage) styleClass = "has-photo";
  }

  const card = document.createElement("div");
  card.className = `menu-item ${styleClass}`;
  card.id = `prod-${product.id}`;
  card.dataset.cat = product.category_id;
  card.dataset.tags = tags.join(',');

  let variantHtml = "";
  if (variants.length > 0) {
    variantHtml = `<div class="item-variants">` + variants.map((v, i) => `
      <button class="variant-btn ${i===0?'active':''}" onclick="selectVariant(this, '${escapeHtml(v.name)}', ${v.price})">${escapeHtml(v.name)} ($${v.price})</button>
    `).join("") + `</div>`;
  }

  let displayPrice = special_price || product.price;
  let initialAddName = product.name;

  if (variants.length > 0) {
    displayPrice = variants[0].price;
    initialAddName = `${product.name} (${variants[0].name})`;
  }

  const originalPriceHtml = special_price ? `<span class="old-price">$${Number(product.price).toLocaleString("es-MX")}</span>` : "";

  card.innerHTML = `
    ${(styleClass !== 'text-card' && hasImage) ? `<div class="item-photo"><img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy" /></div>` : ""}
    <div class="item-body">
      ${isFeatured ? '<span class="featured-badge">✦ &nbsp;Recomendado</span>' : ''}
      <div class="item-header">
        <h3 class="item-name">${escapeHtml(product.name)}</h3>
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
                data-base-name="${escapeHtml(product.name)}"
                onclick="addToOrder(this, '${escapeHtml(initialAddName)}', ${displayPrice}, '${qtyId}')">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Agregar
        </button>
      </div>
    </div>
  `;
  return card;
}

window.selectVariant = (btn, name, price) => {
  const container = btn.closest('.item-variants');
  container.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const card = btn.closest('.menu-item');
  card.querySelector('.item-price').textContent = `$${Number(price).toLocaleString("es-MX")}`;

  const addBtn = card.querySelector('.add-btn');
  const baseName = addBtn.dataset.baseName;
  const onclick = addBtn.getAttribute('onclick');
  const qtyId = onclick.match(/'(qty-[^']+)'/)[1];
  const fullName = `${baseName} (${name})`;
  addBtn.onclick = () => addToOrder(addBtn, fullName, price, qtyId);
};

async function renderMenu() {
  const container = document.getElementById("menu-categories-container");
  const bebidasGrids = document.getElementById("bebidasGrids");
  if (!container) return;

  let [categories, products] = await Promise.all([fetchCategories(), fetchProducts()]);

  // Load dynamic config from ___SYSTEM_TAGS___
  const tagsRecord = products.find(p => p.name === '___SYSTEM_TAGS___');
  if (tagsRecord) {
    try {
      const config = JSON.parse(tagsRecord.description);
      currentMenuTags = config.tags || defaultMenuTags;
      currentWeeklyCombos = config.weeklyCombos || {};
      currentSpotlightManualConfig = config.spotlightManualConfig || currentSpotlightManualConfig;
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
      filterInner.innerHTML = `<button class="filter-btn active" data-filter="all">Todo el menú</button><div class="filter-divider"></div>`;
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
      const bBtn = document.createElement("button");
      bBtn.className = "filter-btn";
      bBtn.dataset.filter = "bebidas";
      bBtn.textContent = "Bebidas";
      bBtn.onclick = () => applyMenuFilter(bBtn);
      filterInner.appendChild(bBtn);
      const div2 = document.createElement("div");
      div2.className = "filter-divider";
      filterInner.appendChild(div2);

      // Dynamic Tags
      currentMenuTags.forEach(tag => {
          const tBtn = document.createElement("button");
          tBtn.className = "filter-btn";
          tBtn.dataset.filter = tag.id;
          tBtn.textContent = tag.label;
          tBtn.onclick = () => applyMenuFilter(tBtn);
          filterInner.appendChild(tBtn);
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
            {id:'caliente', label:'Calientes'},
            {id:'fria', label:'Frías'},
            {id:'jugo', label:'Jugos & Licuados'}
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
                typeProducts.forEach(p => grid.appendChild(renderProductCard(p)));
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
            other.forEach(p => grid.appendChild(renderProductCard(p)));
            bebidasGrids.appendChild(grid);
        }
    } else {
        const header = document.createElement("div");
        header.className = "cat-header reveal";
        header.dataset.cat = cat.id;
        header.innerHTML = `<div><span class="cat-num">0${idx+1}</span><h2 class="cat-title">${escapeHtml(cat.name)}</h2></div>`;
        const grid = document.createElement("div");
        grid.className = "menu-grid";
        grid.dataset.cat = cat.id;
        catProducts.forEach(p => grid.appendChild(renderProductCard(p)));
        container.appendChild(header);
        container.appendChild(grid);
    }
  });

  // Spotlight — Platillo del Día / Combo / Manual
  const today = new Date().getDay();
  const combo = currentWeeklyCombos[today];
  const spotlightSection = document.querySelector(".menu-spotlight");

  if (currentSpotlightManualConfig.active && currentSpotlightManualConfig.productId) {
      // Manual spotlight overrides everything
      const p = products.find(prod => prod.id === currentSpotlightManualConfig.productId);
      if (p && spotlightSection) {
          spotlightSection.style.display = "grid";
          const { desc } = parseVariants(p);
          const price = currentSpotlightManualConfig.price || p.price;
          document.getElementById("spotlightTitle").textContent = p.name;
          document.getElementById("spotlightDescription").textContent = desc;
          document.getElementById("spotlightTotal").textContent = `$${Number(price).toLocaleString("es-MX")}`;
          if (p.image_url) document.getElementById("spotlightImageOne").src = p.image_url;

          const actionBtn = spotlightSection.querySelector(".spotlight-btn.primary");
          actionBtn.textContent = "Agregar Platillo";
          actionBtn.onclick = (e) => {
              e.preventDefault();
              addToOrder(actionBtn, p.name, price, 'spotlight-qty');
          }
      }
  } else if (combo && combo.title) {
      spotlightSection.style.display = "grid";
      document.getElementById("spotlightTitle").textContent = combo.title;
      document.getElementById("spotlightDescription").textContent = combo.subtitle;
      document.getElementById("spotlightTotal").textContent = `$${Number(combo.price).toLocaleString("es-MX")}`;

      const p1 = products.find(p => p.id === combo.dish1);
      const p2 = products.find(p => p.id === combo.dish2);
      if (p1 && p1.image_url) document.getElementById("spotlightImageOne").src = p1.image_url;

      const actionBtn = spotlightSection.querySelector(".spotlight-btn.primary");
      actionBtn.textContent = "Agregar Combo";
      actionBtn.onclick = (e) => {
          e.preventDefault();
          addToOrder(actionBtn, combo.title, combo.price, 'spotlight-qty');
      }
  } else {
      // Fallback to legacy featured item
      const spotlightProd = products.find(p => p.featured && !categories.find(c => c.id === p.category_id)?.name.toLowerCase().includes('bebida'));
      if (spotlightProd && spotlightSection) {
          spotlightSection.style.display = "grid";
          const { desc, special_price } = parseVariants(spotlightProd);
          const displayPrice = special_price || spotlightProd.price;
          document.getElementById("spotlightTitle").textContent = spotlightProd.name;
          document.getElementById("spotlightDescription").textContent = desc;
          document.getElementById("spotlightTotal").textContent = `$${Number(displayPrice).toLocaleString("es-MX")}`;
          if (spotlightProd.image_url) document.getElementById("spotlightImageOne").src = spotlightProd.image_url;

          const actionBtn = spotlightSection.querySelector(".spotlight-btn.primary");
          actionBtn.textContent = "Agregar Platillo";
          actionBtn.onclick = (e) => {
              e.preventDefault();
              addToOrder(actionBtn, spotlightProd.name, displayPrice, 'spotlight-qty');
          }
      } else if (spotlightSection) {
          spotlightSection.style.display = "none";
      }
  }

  filterBtns = document.querySelectorAll(".filter-btn");
  catHeaders = document.querySelectorAll(".cat-header");
  menuGrids = document.querySelectorAll(".menu-grid");
  document.querySelectorAll(".menu-item").forEach(prepareCardAnimation);
  document.querySelectorAll(".reveal").forEach(el => revealObs.observe(el));
}

// ===== PREVIEW MESSAGE LISTENER =====
window.addEventListener('message', (event) => {
  if (event.data.type === 'PREVIEW_UPDATE') renderLivePreviewItem(event.data.product);
});

function renderLivePreviewItem(product) {
  let previewSection = document.getElementById('admin-live-preview-section');
  if (!previewSection) {
    previewSection = document.createElement('section');
    previewSection.id = 'admin-live-preview-section';
    previewSection.style.padding = "2rem";
    previewSection.style.background = "linear-gradient(135deg, #fff3cd 0%, #fcf8e3 100%)";
    previewSection.style.borderBottom = "2px solid #ffeeba";
    previewSection.style.position = "relative";
    previewSection.style.zIndex = "1000";
    previewSection.innerHTML = `
      <div style="text-align:center; font-family:'Syne',sans-serif; font-size:0.6rem; font-weight:800; color:#856404; text-transform:uppercase; letter-spacing:0.2em; margin-bottom:1.5rem;">
        ✦ Editando ahora
      </div>
      <div id="preview-item-container" class="menu-grid" style="grid-template-columns:1fr; max-width:450px; margin:0 auto; box-shadow: 0 20px 40px rgba(0,0,0,0.1);"></div>
    `;
    document.body.prepend(previewSection);
  }
  const container = document.getElementById('preview-item-container');
  container.innerHTML = "";
  const card = renderProductCard(product);
  container.appendChild(card);

  card.style.opacity = "1";
  card.style.transform = "none";
  card.classList.add('visible');

  previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = kind === "remove" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      gain.gain.setValueAtTime(0.0001, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.075, now + i * 0.055 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.12);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now + i * 0.055); osc.stop(now + i * 0.055 + 0.13);
    });
  } catch (e) {}
}
function playFeedback(kind = "add") {
  if (kind === "add") { addSound.currentTime = 0; addSound.play().catch(() => playTone(kind)); return; }
  playTone(kind);
}

// ===== ORDER STATE =====
let orderItems = {};
let orderOpen = false;

function normalizeItemName(name) {
  const fixes = { "CafÃ© de Olla": "Café de Olla", "CafÃƒÂ© de Olla": "Café de Olla" };
  return fixes[name] || name;
}
function normalizeCartItems(items) {
  const normalized = {};
  Object.keys(items || {}).forEach((key) => {
    const item = items[key]; const name = normalizeItemName(item.name || key);
    if (normalized[name]) { normalized[name].qty += item.qty || 0; return; }
    normalized[name] = { ...item, name };
  });
  return normalized;
}

function loadCartFromStorage() {
  try {
    const saved = sessionStorage.getItem("labocata_cart");
    if (saved) {
      orderItems = normalizeCartItems(JSON.parse(saved));
      updateCart();
      document.querySelectorAll(".add-btn").forEach((btn) => {
        const onclick = btn.getAttribute('onclick'); if (!onclick) return;
        const nameMatch = onclick.match(/'([^']+)'/); if (!nameMatch) return;
        const name = normalizeItemName(nameMatch[1]);
        if (orderItems[name]) {
            const qtyIdMatch = onclick.match(/'(qty-[^']+)'/);
            if (qtyIdMatch) {
                const qtyId = qtyIdMatch[1]; const qtyEl = document.getElementById(qtyId);
                if (qtyEl) { btn.style.display = "none"; qtyEl.classList.add("visible"); renderInlineQty(qtyEl, name, orderItems[name].price); }
            }
        }
      });
    }
  } catch (e) { orderItems = {}; }
}
function saveCartToStorage() {
  try { orderItems = normalizeCartItems(orderItems); sessionStorage.setItem("labocata_cart", JSON.stringify(orderItems)); } catch (e) {}
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
  if (!toast) { toast = document.createElement("div"); toast.className = "toast"; toast.id = "globalToast"; document.body.appendChild(toast); }
  toast.innerHTML = `<strong>${name}</strong><span>${action}</span>`;
  toast.classList.add("show");
  clearTimeout(toast._timeout); toast._timeout = setTimeout(() => toast.classList.remove("show"), 2200);
}

function addToOrder(btn, name, price, qtyId) {
  name = normalizeItemName(name); playFeedback("add");
  if (navigator.vibrate) navigator.vibrate(30);
  if (orderItems[name]) orderItems[name].qty++; else orderItems[name] = { name, price, qty: 1 };
  const qtyEl = document.getElementById(qtyId);
  if (qtyEl) {
      btn.style.display = "none"; qtyEl.classList.add("visible"); renderInlineQty(qtyEl, name, price);
  }
  updateCart(); bumpBadge(); showToast(name); saveCartToStorage();
}

function renderInlineQty(el, name, price) {
  const qty = orderItems[name] ? orderItems[name].qty : 0;
  el.innerHTML = "";
  const m = document.createElement("button"); m.className = "qty-btn"; m.textContent = "−";
  m.onclick = () => changeQty(name, -1, el.id);
  const n = document.createElement("span"); n.className = "qty-num"; n.textContent = qty;
  const p = document.createElement("button"); p.className = "qty-btn"; p.textContent = "+";
  p.onclick = () => changeQty(name, 1, el.id);
  el.append(m, n, p);
}

window.changeQty = (name, delta, qtyId) => {
    if (!orderItems[name]) return;
    orderItems[name].qty += delta; playFeedback(delta > 0 ? "add" : "remove");
    if (orderItems[name].qty <= 0) {
        delete orderItems[name];
        const el = document.getElementById(qtyId); if (el) { el.classList.remove("visible"); el.innerHTML = ""; const btn = el.nextElementSibling; if (btn) btn.style.display = ""; }
    } else {
        const el = document.getElementById(qtyId); if (el) renderInlineQty(el, name);
    }
    updateCart(); saveCartToStorage();
};

function updateCart() {
  const keys = Object.keys(orderItems);
  const total = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
  const count = keys.reduce((s, k) => s + orderItems[k].qty, 0);

  document.getElementById("cartBadge").textContent = count;
  document.getElementById("fabBadge").textContent = count;
  document.getElementById("fabAmount").textContent = "$" + total.toLocaleString("es-MX");
  document.getElementById("orderMeterCount").textContent = `${count} item${count !== 1 ? "s" : ""}`;
  document.getElementById("orderMeterTotal").textContent = "$" + total.toLocaleString("es-MX");
  document.getElementById("orderMeta").textContent = count ? `${count} item${count !== 1 ? "s" : ""} en tu orden` : "Sin platillos agregados";
  document.getElementById("orderFab").classList.toggle("visible", count > 0);

  const container = document.getElementById("orderItems");
  const empty = document.getElementById("orderEmpty");
  const footer = document.getElementById("orderFooter");

  if (keys.length === 0) { empty.style.display = ""; footer.style.display = "none"; container.innerHTML = ""; return; }
  empty.style.display = "none"; footer.style.display = "";
  container.innerHTML = "";
  keys.forEach((key) => {
    const item = orderItems[key]; const line = document.createElement("div"); line.className = "order-line";
    line.innerHTML = `<div class="order-line-qty">x${item.qty}</div><div class="order-line-info"><div class="order-line-name">${escapeHtml(item.name)}</div><div class="order-line-price">$${(item.price * item.qty).toLocaleString("es-MX")} · $${item.price} c/u</div></div><div class="order-line-actions"><button class="order-qty-btn" onclick="panelQty('${key}', -1)">−</button><span class="order-qty-num">${item.qty}</span><button class="order-qty-btn" onclick="panelQty('${key}', 1)">+</button></div>`;
    container.appendChild(line);
  });
  const sub = document.getElementById("orderSubtotals");
  sub.innerHTML = `<div class="order-row"><span>Subtotal</span><span>$${total.toLocaleString("es-MX")}</span></div><div class="order-row"><span>Servicio (10%)</span><span>$${Math.round(total * 0.1).toLocaleString("es-MX")}</span></div><div class="order-row total"><span>Total</span><span>$${Math.round(total * 1.1).toLocaleString("es-MX")}</span></div>`;
}

window.panelQty = (name, delta) => {
    if (!orderItems[name]) return;
    orderItems[name].qty += delta; playFeedback(delta > 0 ? "add" : "remove");
    if (orderItems[name].qty <= 0) {
        delete orderItems[name];
        document.querySelectorAll(".qty-ctrl").forEach(el => {
            const btn = el.nextElementSibling;
            if (btn && btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${name}'`)) { el.classList.remove('visible'); el.innerHTML = ""; btn.style.display = ""; }
        });
    } else {
        document.querySelectorAll(".qty-ctrl").forEach(el => {
            const btn = el.nextElementSibling;
            if (btn && btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${name}'`)) { renderInlineQty(el, name); }
        });
    }
    updateCart(); saveCartToStorage();
};

function saveLastOrder(orderNum, items, notes) {
  const keys = Object.keys(items);
  const snapshot = { orderNum, items, notes, total: Math.round(keys.reduce((s, k) => s + items[k].price * items[k].qty, 0) * 1.1), createdAt: new Date().toISOString() };
  try { sessionStorage.setItem("labocata_last_order", JSON.stringify(snapshot)); } catch (e) {}
  renderLastOrder(snapshot);
}
function renderLastOrder(order = null) {
  const card = document.getElementById("lastOrderCard"); if (!card) return;
  if (!order) { try { const saved = sessionStorage.getItem("labocata_last_order"); order = saved ? JSON.parse(saved) : null; } catch (e) {} }
  if (!order || !order.items || Object.keys(order.items).length === 0) return;
  const count = Object.keys(order.items).reduce((s, k) => s + order.items[k].qty, 0);
  const items = Object.keys(order.items).map((k) => `<li><span>${order.items[k].qty}x ${order.items[k].name}</span><strong>$${(order.items[k].price * order.items[k].qty).toLocaleString("es-MX")}</strong></li>`).join("");
  const date = new Date(order.createdAt).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  card.innerHTML = `<span class="last-order-kicker">Orden ${order.orderNum} · ${date}</span><h3>${count} item${count !== 1 ? "s" : ""} guardado${count !== 1 ? "s" : ""}</h3><ul class="last-order-list">${items}</ul><div class="last-order-total"><span>Total con servicio</span><strong>$${order.total.toLocaleString("es-MX")}</strong></div>`;
}
function repeatLastOrder() {
  try {
    const saved = sessionStorage.getItem("labocata_last_order"); if (!saved) { showToast("Sin pedido previo"); return; }
    const last = JSON.parse(saved); orderItems = JSON.parse(JSON.stringify(last.items || {}));
    saveCartToStorage(); loadCartFromStorage(); updateCart(); toggleOrder(true); playFeedback("success");
  } catch (e) {}
}

window.confirmOrder = () => {
  const keys = Object.keys(orderItems); if (keys.length === 0) return;
  const orderNum = "BOC-" + Math.floor(Math.random() * 9000 + 1000); const notes = document.getElementById("orderNotes").value;
  let msg = `¡Hola Labocata! 🍳 Pedido:\n\n`;
  keys.forEach((k) => { msg += `• ${orderItems[k].qty}x ${orderItems[k].name} — $${(orderItems[k].price * orderItems[k].qty).toLocaleString("es-MX")}\n`; });
  const total = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
  msg += `\n💰 Total (con servicio): $${Math.round(total * 1.1).toLocaleString("es-MX")}`;
  if (notes) msg += `\n📝 Notas: ${notes}`; msg += `\n\n#${orderNum}`;
  window.open(`https://wa.me/529210000000?text=${encodeURIComponent(msg)}`, "_blank");
  saveLastOrder(orderNum, JSON.parse(JSON.stringify(orderItems)), notes);
  playFeedback("success");
  document.getElementById("orderNum").textContent = "Orden #" + orderNum; document.getElementById("orderContent").style.display = "none"; document.getElementById("orderSuccess").classList.add("show");
};

window.resetOrder = () => {
  orderItems = {}; saveCartToStorage(); document.getElementById("orderContent").style.display = "flex"; document.getElementById("orderSuccess").classList.remove("show");
  document.querySelectorAll(".qty-ctrl").forEach((el) => { el.classList.remove("visible"); el.innerHTML = ""; });
  document.querySelectorAll(".add-btn").forEach((btn) => { btn.style.display = ""; });
  document.getElementById("orderNotes").value = ""; updateCart(); toggleOrder(false);
};

function bumpBadge() { const badge = document.getElementById("cartBadge"); if(badge) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); } }

window.setOrderType = (type) => {
  const btnPickup = document.getElementById("btnPickup"); const btnDelivery = document.getElementById("btnDelivery");
  const pickupInfo = document.getElementById("pickupInfo"); const deliveryFields = document.getElementById("deliveryFields");
  if (type === "pickup") { if(btnPickup) btnPickup.classList.add("active"); if(btnDelivery) btnDelivery.classList.remove("active"); if(pickupInfo) pickupInfo.classList.add("show"); if(deliveryFields) deliveryFields.classList.remove("show"); }
  else { if(btnDelivery) btnDelivery.classList.add("active"); if(btnPickup) btnPickup.classList.remove("active"); if(deliveryFields) deliveryFields.classList.add("show"); if(pickupInfo) pickupInfo.classList.remove("show"); }
};

// ===== ANIMATIONS =====
const revealObs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }), { threshold: 0.1 });
const cardObs = new IntersectionObserver(entries => entries.forEach((e, i) => {
  if (e.isIntersecting) { setTimeout(() => { e.target.style.opacity = "1"; e.target.style.transform = "translateY(0)"; }, (i % 4) * 60); cardObs.unobserve(e.target); }
}), { threshold: 0.05 });
function prepareCardAnimation(el) { el.style.opacity = "0"; el.style.transform = "translateY(16px)"; el.style.transition = "opacity 0.6s, transform 0.6s ease-out"; cardObs.observe(el); }

document.addEventListener("DOMContentLoaded", async () => {
  if (window.self !== window.top) document.body.classList.add('is-preview');
  await renderMenu(); loadCartFromStorage(); renderLastOrder();
});
