// ===== NAV SCROLL =====
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  if (nav) nav.classList.toggle("scrolled", window.scrollY > 60);
});

// ===== HELPERS =====
function escapeHtml(v = "") {
  return String(v).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])
  );
}
function stripHtml(v = "") {
  return String(v).replace(/<[^>]*>/g, "").trim();
}

// ===== FILTER — Comida =====
// Siempre consulta el DOM en vivo, nunca usa variables cacheadas
function applyMenuFilter(btn) {
  // Marcar botón activo
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  const catId = btn.dataset.catId; // UUID de Supabase

  // Mostrar todo primero
  document.querySelectorAll(".food-cat-header").forEach(h => h.style.display = "");
  document.querySelectorAll(".food-cat-grid").forEach(g => g.style.display = "");

  if (catId === "all") return;

  // Ocultar los que no coincidan
  document.querySelectorAll(".food-cat-header").forEach(h => {
    h.style.display = h.dataset.catId === catId ? "" : "none";
  });
  document.querySelectorAll(".food-cat-grid").forEach(g => {
    g.style.display = g.dataset.catId === catId ? "" : "none";
  });

  // Scroll suave a la sección
  setTimeout(() => {
    const target = document.querySelector(`.food-cat-header[data-cat-id="${catId}"]`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

// ===== FILTER — Bebidas =====
function applyDrinkFilter(btn) {
  document.querySelectorAll(".bebidas-filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  const tipo = btn.dataset.tipo; // "todas" | "caliente" | "fria" | "jugo"

  document.querySelectorAll(".drink-cat-grid").forEach(grid => {
    const show = tipo === "todas" || grid.dataset.tipo === tipo;
    grid.style.display = show ? "" : "none";
    const hdr = grid.previousElementSibling;
    if (hdr && hdr.classList.contains("drink-cat-header"))
      hdr.style.display = show ? "" : "none";
  });
}

// ===== DATOS =====
const defaultMenuTags = [
  { id:"v",     label:"Vegetariano" },
  { id:"vg",    label:"Vegano"      },
  { id:"gf",    label:"Sin gluten"  },
  { id:"s",     label:"Signature"   },
  { id:"nuevo", label:"Nuevo"       }
];
let currentMenuTags     = defaultMenuTags;
let currentWeeklyCombos = {};
let currentCategoryMeta = {};
let currentCategories   = [];

function parseDesc(product) {
  try {
    if (product.description && product.description.startsWith("{")) {
      const d = JSON.parse(product.description);
      return {
        desc:          d.main_description || "",
        variants:      d.variants         || [],
        tipo_bebida:   d.tipo_bebida      || null,
        special_price: d.special_price    || null,
        tags:          d.tags             || [],
        visual_style:  d.visual_style     || "auto",
        featured_text: d.featured_text    || null
      };
    }
  } catch(e) {}
  return { desc: product.description || "", variants: [], tipo_bebida: null,
           special_price: null, tags: [], visual_style: "auto", featured_text: null };
}

function renderTagSpans(tags = []) {
  const map = currentMenuTags.reduce((m, t) => { m[t.id] = t.label; return m; }, {});
  return tags.map(tag => {
    const cls = currentMenuTags.some(t => t.id === tag) ? tag : "custom";
    return `<span class="item-tag ${cls}">${escapeHtml(map[tag] || tag)}</span>`;
  }).join("");
}

// ===== RENDER PRODUCTO =====
function renderProductCard(product) {
  const { desc, variants, special_price, tags, visual_style, featured_text } = parseDesc(product);
  const qtyId     = `qty-${product.id}`;
  const hasImage  = Boolean(product.image_url);
  const isFeat    = product.featured;
  const plainName = stripHtml(product.name);

  // Estilo de tarjeta
  let styleClass = "text-card";
  if      (visual_style === "featured") styleClass = "featured";
  else if (visual_style === "photo")    styleClass = "has-photo";
  else if (visual_style === "text")     styleClass = "text-card";
  else if (isFeat)                      styleClass = "featured";
  else if (hasImage)                    styleClass = "has-photo";

  // Precio e nombre inicial para la orden
  let displayPrice = Number(special_price || product.price);
  let initialName  = plainName;
  if (variants.length > 0) {
    displayPrice = Number(variants[0].price) || displayPrice;
    initialName  = `${plainName} (${variants[0].name})`;
  }

  const oldPriceHtml = (special_price && Number(product.price))
    ? `<span class="old-price">$${Number(product.price).toLocaleString("es-MX")}</span>`
    : "";

  const imageHtml = (styleClass !== "text-card" && hasImage)
    ? `<div class="item-photo"><img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(plainName)}" loading="lazy"/></div>`
    : "";

  const variantHtml = variants.length > 0
    ? `<div class="item-variants">${variants.map((v, i) =>
        `<button class="variant-btn${i===0?" active":""}" data-vname="${escapeHtml(v.name)}" data-vprice="${v.price}">
           ${escapeHtml(v.name)} ($${v.price})
         </button>`).join("")}</div>`
    : "";

  const card = document.createElement("div");
  card.className   = `menu-item reveal ${styleClass}`;
  card.id          = `prod-${product.id}`;
  card.dataset.cat = product.category_id;

  card.innerHTML = `
    ${imageHtml}
    <div class="item-body">
      ${isFeat ? `<span class="featured-badge">✦ &nbsp;${escapeHtml(featured_text || "Recomendado")}</span>` : ""}
      <div class="item-header">
        <h3 class="item-name">${product.name}</h3>
        <div class="price-wrapper">
          ${oldPriceHtml}
          <span class="item-price${special_price ? " special" : ""}" id="price-${product.id}">
            $${displayPrice.toLocaleString("es-MX")}
          </span>
        </div>
      </div>
      <p class="item-desc">${escapeHtml(desc)}</p>
      ${variantHtml}
      <div class="item-footer">
        <div class="item-tags">${renderTagSpans(tags)}</div>
        <div class="qty-ctrl" id="${qtyId}"></div>
        <button class="add-btn" type="button"
                data-iname="${escapeHtml(initialName)}"
                data-iprice="${displayPrice}"
                data-qtyid="${qtyId}">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Agregar
        </button>
      </div>
    </div>`;

  // Listener del botón agregar
  card.querySelector(".add-btn").addEventListener("click", function() {
    addToOrder(this, this.dataset.iname, parseFloat(this.dataset.iprice), this.dataset.qtyid);
  });

  // Listeners de variantes
  card.querySelectorAll(".variant-btn").forEach(vBtn => {
    vBtn.addEventListener("click", function() {
      this.closest(".item-variants").querySelectorAll(".variant-btn")
        .forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const vPrice = parseFloat(this.dataset.vprice);
      const vName  = this.dataset.vname;
      card.querySelector(".item-price").textContent = `$${Number(vPrice).toLocaleString("es-MX")}`;
      const ab = card.querySelector(".add-btn");
      ab.dataset.iname  = `${plainName} (${vName})`;
      ab.dataset.iprice = vPrice;
    });
  });

  return card;
}

// ===== RENDER MENÚ COMPLETO =====
async function renderMenu() {
  const foodContainer = document.getElementById("menu-categories-container");
  const drinkContainer = document.getElementById("bebidasGrids");
  const filterBar     = document.getElementById("filterInner");
  const drinkBar      = document.getElementById("bebidasFilterBar");

  if (!foodContainer) return;

  // Fetch datos
  const [catRes, prodRes] = await Promise.all([
    window.supabaseClient.from("categories").select("*").order("created_at", { ascending: true }),
    window.supabaseClient.from("products").select("*")
  ]);

  const categories = catRes.data  || [];
  const products   = prodRes.data || [];
  currentCategories = categories;

  // Parsear config del sistema
  const sysRec = products.find(p => p.name === "___SYSTEM_TAGS___");
  if (sysRec) {
    try {
      const cfg = JSON.parse(sysRec.description);
      currentMenuTags     = cfg.tags             || defaultMenuTags;
      currentWeeklyCombos = cfg.weeklyCombos     || {};
      currentCategoryMeta = cfg.categoryMetadata || {};
      const ordered = cfg.orderedCategoryIds || [];
      if (ordered.length) {
        categories.sort((a, b) => {
          const ia = ordered.indexOf(a.id), ib = ordered.indexOf(b.id);
          if (ia === -1 && ib === -1) return 0;
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        });
      }
    } catch(e) { console.error("Config error:", e); }
  }

  // Separar categorías de comida y bebida
  const foodCats  = categories.filter(c => !c.name.toLowerCase().includes("bebida"));
  const drinkCats = categories.filter(c =>  c.name.toLowerCase().includes("bebida"));

  // ── Construir barra de filtros de COMIDA ─────────────────────
  if (filterBar) {
    filterBar.innerHTML = "";

    // Botón "Todo"
    const allBtn = document.createElement("button");
    allBtn.className       = "filter-btn active";
    allBtn.dataset.catId   = "all";
    allBtn.textContent     = "Todo el menú";
    allBtn.addEventListener("click", () => applyMenuFilter(allBtn));
    filterBar.appendChild(allBtn);

    // Solo mostrar categorias que tengan productos reales
    foodCats.forEach(cat => {
      const hasProds = products.some(p =>
        p.category_id === cat.id && p.name !== "___SYSTEM_TAGS___"
      );
      if (!hasProds) return;

      const div = document.createElement("div");
      div.className = "filter-divider";
      filterBar.appendChild(div);

      const btn = document.createElement("button");
      btn.className     = "filter-btn";
      btn.dataset.catId = cat.id;
      btn.textContent   = cat.name;
      btn.addEventListener("click", () => applyMenuFilter(btn));
      filterBar.appendChild(btn);
    });

    // Leyenda dietética
    const dietary = document.createElement("div");
    dietary.className = "filter-dietary";
    dietary.innerHTML = currentMenuTags.map(t =>
      `<span class="dietary-tag"><span class="diet-dot ${t.id}"></span>${t.label}</span>`
    ).join("");
    filterBar.appendChild(dietary);
  }

  // ── Construir barra de filtros de BEBIDAS ────────────────────
  if (drinkBar) {
    drinkBar.innerHTML = "";
    [
      { tipo: "todas",    label: "Todas" },
      { tipo: "caliente", label: "Calientes" },
      { tipo: "fria",     label: "Frías" },
      { tipo: "jugo",     label: "Jugos & Licuados" }
    ].forEach((item, i) => {
      if (i > 0) {
        const div = document.createElement("div");
        div.className = "filter-divider";
        drinkBar.appendChild(div);
      }
      const btn = document.createElement("button");
      btn.className          = `bebidas-filter-btn${i === 0 ? " active" : ""}`;
      btn.dataset.tipo       = item.tipo;
      btn.textContent        = item.label;
      btn.addEventListener("click", () => applyDrinkFilter(btn));
      drinkBar.appendChild(btn);
    });
  }

  // ── Limpiar contenedores ─────────────────────────────────────
  foodContainer.innerHTML  = "";
  if (drinkContainer) drinkContainer.innerHTML = "";

  // ── Renderizar categorias de COMIDA ─────────────────────────
  let foodIdx = 0;
  foodCats.forEach((cat) => {
    const catProds = products.filter(p =>
      p.category_id === cat.id && p.name !== "___SYSTEM_TAGS___"
    );
    if (!catProds.length) return; // saltar categorias vacias
    const idx = foodIdx++;

    const meta = currentCategoryMeta[cat.id] || { title: cat.name, description: "" };

    // Header — usa data-cat-id (UUID)
    const hdr = document.createElement("div");
    hdr.className         = "cat-header food-cat-header reveal";
    hdr.dataset.catId     = cat.id;   // ← mismo valor que el botón del filtro
    hdr.innerHTML = `
      <div>
        <span class="cat-num">0${idx + 1} — ${escapeHtml(cat.name)}</span>
        <h2 class="cat-title">${meta.title || cat.name}</h2>
      </div>
      ${meta.description ? `<p class="cat-desc">${escapeHtml(meta.description)}</p>` : ""}`;

    // Grid — usa data-cat-id (UUID)
    const grid = document.createElement("div");
    grid.className     = "menu-grid food-cat-grid";
    grid.dataset.catId = cat.id;      // ← mismo valor que el botón del filtro

    catProds.forEach((p, i) => {
      const card = renderProductCard(p);
      if (i % 5 > 0) card.classList.add(`reveal-delay-${i % 5}`);
      grid.appendChild(card);
    });

    foodContainer.appendChild(hdr);
    foodContainer.appendChild(grid);
  });

  // ── Renderizar categorías de BEBIDAS ─────────────────────────
  if (drinkContainer) {
    drinkCats.forEach(cat => {
      const catProds = products.filter(p =>
        p.category_id === cat.id && p.name !== "___SYSTEM_TAGS___"
      );

      // Agrupar por tipo
      const tipos = [
        { tipo: "caliente", label: "Calientes" },
        { tipo: "fria",     label: "Frías" },
        { tipo: "jugo",     label: "Jugos & Licuados" },
        { tipo: "otras",    label: "Bebidas" }
      ];

      tipos.forEach(({ tipo, label }) => {
        const tp = tipo === "otras"
          ? catProds.filter(p => !parseDesc(p).tipo_bebida)
          : catProds.filter(p => parseDesc(p).tipo_bebida === tipo);

        if (!tp.length) return;

        const hdr = document.createElement("div");
        hdr.className     = "cat-header drink-cat-header bebidas-subheader reveal";
        hdr.dataset.tipo  = tipo;
        hdr.innerHTML = `<div><span class="cat-num">Bebidas</span>
                          <h2 class="cat-title">${label}</h2></div>`;

        const grid = document.createElement("div");
        grid.className    = "menu-grid drink-cat-grid bebidas-grid";
        grid.dataset.tipo = tipo;     // ← mismo valor que el botón del filtro

        tp.forEach((p, i) => {
          const card = renderProductCard(p);
          if (i % 5 > 0) card.classList.add(`reveal-delay-${i % 5}`);
          grid.appendChild(card);
        });

        drinkContainer.appendChild(hdr);
        drinkContainer.appendChild(grid);
      });
    });
  }

  // ── Spotlight ─────────────────────────────────────────────────
  const spotlightSection = document.querySelector(".menu-spotlight");
  const today = new Date().getDay();
  const combo = currentWeeklyCombos[today];

  if (combo && combo.title && spotlightSection) {
    spotlightSection.style.display = "grid";
    document.getElementById("spotlightTitle").innerHTML         = combo.title;
    document.getElementById("spotlightDescription").textContent = combo.subtitle;
    document.getElementById("spotlightTotal").textContent       = `$${Number(combo.price).toLocaleString("es-MX")}`;
    const p1 = products.find(p => p.id === combo.dish1);
    if (p1?.image_url) document.getElementById("spotlightImageOne").src = p1.image_url;
    const pb = spotlightSection.querySelector(".spotlight-btn.primary");
    if (pb) {
      pb.textContent = "Agregar Combo";
      pb.onclick = () => addToOrder(pb, stripHtml(combo.title), Number(combo.price), "qty-spotlight");
    }
  } else if (spotlightSection) {
    const sp = products.find(p =>
      p.featured && !categories.find(c => c.id === p.category_id)?.name.toLowerCase().includes("bebida")
    );
    if (sp) {
      spotlightSection.style.display = "grid";
      const { desc, special_price } = parseDesc(sp);
      const dp = Number(special_price || sp.price);
      document.getElementById("spotlightTitle").innerHTML         = sp.name;
      document.getElementById("spotlightDescription").textContent = desc;
      document.getElementById("spotlightTotal").textContent       = `$${dp.toLocaleString("es-MX")}`;
      if (sp.image_url) document.getElementById("spotlightImageOne").src = sp.image_url;
      const pb = spotlightSection.querySelector(".spotlight-btn.primary");
      if (pb) {
        pb.textContent = "Agregar Platillo";
        pb.onclick = () => addToOrder(pb, stripHtml(sp.name), dp, "qty-spotlight");
      }
    } else {
      spotlightSection.style.display = "none";
    }
  }

  // Activar animaciones reveal
  document.querySelectorAll(".reveal").forEach(el => revealObs.observe(el));

  // Restaurar carrito
  restoreCartUI();
}

// ===== PREVIEW (iframe admin) =====
window.addEventListener("message", e => {
  if (e.data.type === "PREVIEW_UPDATE") previewProduct(e.data.product);
});
function previewProduct(product) {
  const existing = document.getElementById(`prod-${product.id}`);
  const newCard  = renderProductCard(product);
  newCard.classList.add("visible");
  newCard.style.cssText = "transition:none;opacity:1;transform:translateY(0)";
  if (existing) existing.replaceWith(newCard);
  else {
    const grid = document.querySelector(`.food-cat-grid[data-cat-id="${product.category_id}"]`);
    if (grid) grid.prepend(newCard);
  }
  newCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ===== SONIDO =====
const addSound = new Audio("Sounds/Click.mp3");
let audioCtx;
function playTone(kind = "add") {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now   = audioCtx.currentTime;
    const tones = { add:[640,880], remove:[300,210], open:[420,540], success:[520,720,980] }[kind] || [520];
    tones.forEach((freq, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = kind === "remove" ? "triangle" : "sine";
      o.frequency.setValueAtTime(freq, now + i * 0.055);
      g.gain.setValueAtTime(0.0001, now + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.075,  now + i * 0.055 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.12);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(now + i * 0.055); o.stop(now + i * 0.055 + 0.13);
    });
  } catch(e) {}
}
function playFeedback(kind = "add") {
  if (kind === "add") { addSound.currentTime = 0; addSound.play().catch(() => playTone(kind)); return; }
  playTone(kind);
}

// ===== ESTADO DEL CARRITO =====
let orderItems = {};
let orderOpen  = false;

function saveCartToStorage() {
  try { sessionStorage.setItem("labocata_cart", JSON.stringify(orderItems)); } catch(e) {}
}
function loadCartFromStorage() {
  try {
    const s = sessionStorage.getItem("labocata_cart");
    if (s) { orderItems = JSON.parse(s); updateCart(); }
  } catch(e) { orderItems = {}; }
}

// Restaurar controles de cantidad tras renderMenu (fix recarga de página)
function restoreCartUI() {
  if (!Object.keys(orderItems).length) return;
  document.querySelectorAll(".add-btn").forEach(btn => {
    const name = btn.dataset.iname;
    if (!name || !orderItems[name]) return;
    const qtyEl = document.getElementById(btn.dataset.qtyid);
    if (!qtyEl) return;
    btn.style.display = "none";
    qtyEl.classList.add("visible");
    renderInlineQty(qtyEl, name, orderItems[name].price);
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
  let t = document.getElementById("globalToast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast"; t.id = "globalToast";
    document.body.appendChild(t);
  }
  t.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${action}</span>`;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

function addToOrder(btn, name, price, qtyId) {
  name  = stripHtml(name);
  price = parseFloat(price) || 0;
  playFeedback("add");
  if (navigator.vibrate) navigator.vibrate(30);
  if (orderItems[name]) orderItems[name].qty++;
  else orderItems[name] = { name, price, qty: 1 };
  const qtyEl = document.getElementById(qtyId);
  if (qtyEl) {
    btn.style.display = "none";
    qtyEl.classList.add("visible");
    renderInlineQty(qtyEl, name, price);
  }
  updateCart(); bumpBadge(); showToast(name); saveCartToStorage();
}

function renderInlineQty(el, name, price) {
  const qty = orderItems[name]?.qty || 0;
  el.innerHTML = "";
  const m = document.createElement("button"); m.className = "qty-btn"; m.textContent = "−";
  const n = document.createElement("span");   n.className = "qty-num"; n.textContent = qty;
  const p = document.createElement("button"); p.className = "qty-btn"; p.textContent = "+";
  m.addEventListener("click", () => changeQty(name, -1, el.id));
  p.addEventListener("click", () => changeQty(name,  1, el.id));
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
      el.classList.remove("visible"); el.innerHTML = "";
      el.closest(".menu-item")?.querySelector(".add-btn")?.style.setProperty("display", "");
    }
  } else {
    const el = document.getElementById(qtyId);
    if (el) renderInlineQty(el, name, orderItems[name].price);
  }
  updateCart(); saveCartToStorage();
};

// ===== PANEL DEL CARRITO =====
function updateCart() {
  const keys  = Object.keys(orderItems);
  const total = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
  const count = keys.reduce((s, k) => s + orderItems[k].qty, 0);

  const g = id => document.getElementById(id);
  if (g("cartBadge"))       g("cartBadge").textContent       = count;
  if (g("fabBadge"))        g("fabBadge").textContent        = count;
  if (g("fabAmount"))       g("fabAmount").textContent       = "$" + total.toLocaleString("es-MX");
  if (g("orderMeterCount")) g("orderMeterCount").textContent = `${count} item${count !== 1 ? "s" : ""}`;
  if (g("orderMeterTotal")) g("orderMeterTotal").textContent = "$" + total.toLocaleString("es-MX");
  if (g("orderMeta"))       g("orderMeta").textContent       = count
    ? `${count} item${count !== 1 ? "s" : ""} en tu orden`
    : "Sin platillos agregados";
  g("orderFab")?.classList.toggle("visible", count > 0);

  const container = g("orderItems");
  const empty     = g("orderEmpty");
  const footer    = g("orderFooter");
  if (!container) return;

  if (!keys.length) {
    if (empty)  empty.style.display  = "";
    if (footer) footer.style.display = "none";
    container.innerHTML = "";
    return;
  }
  if (empty)  empty.style.display  = "none";
  if (footer) footer.style.display = "";

  container.innerHTML = "";
  keys.forEach(key => {
    const item = orderItems[key];
    const line = document.createElement("div");
    line.className = "order-line";

    // Col 1: badge cantidad
    const badge = document.createElement("div");
    badge.className   = "order-line-qty";
    badge.textContent = `x${item.qty}`;

    // Col 2: info
    const info = document.createElement("div");
    info.className = "order-line-info";

    const nameEl = document.createElement("div");
    nameEl.className   = "order-line-name";
    nameEl.textContent = item.name;

    const priceEl = document.createElement("div");
    priceEl.className   = "order-line-price";
    priceEl.textContent = `$${(item.price * item.qty).toLocaleString("es-MX")}`;

    const unitEl = document.createElement("div");
    unitEl.className   = "order-line-unit";
    unitEl.textContent = `$${item.price.toLocaleString("es-MX")} c/u`;

    const noteEl = document.createElement("input");
    noteEl.className   = "order-line-note";
    noteEl.type        = "text";
    noteEl.placeholder = "Modificación (ej: sin cebolla)";
    noteEl.value       = item.notes || "";
    noteEl.maxLength   = 140;
    noteEl.addEventListener("input", () => {
      orderItems[key].notes = noteEl.value;
      saveCartToStorage();
    });

    const actions = document.createElement("div");
    actions.className = "order-line-actions";

    const bMinus = document.createElement("button");
    bMinus.className = "order-qty-btn"; bMinus.textContent = "−";
    const qNum = document.createElement("span");
    qNum.className = "order-qty-num"; qNum.textContent = item.qty;
    const bPlus = document.createElement("button");
    bPlus.className = "order-qty-btn"; bPlus.textContent = "+";

    bMinus.addEventListener("click", () => panelQty(key, -1));
    bPlus.addEventListener("click",  () => panelQty(key,  1));

    actions.append(bMinus, qNum, bPlus);
    info.append(nameEl, priceEl, unitEl, noteEl, actions);
    line.append(badge, info);
    container.appendChild(line);
  });

  const sub = g("orderSubtotals");
  if (sub) {
    const fee = Math.round(total * 0.1);
    sub.innerHTML = `
      <div class="order-row"><span>Subtotal</span><span>$${total.toLocaleString("es-MX")}</span></div>
      <div class="order-row"><span>Servicio (10%)</span><span>$${fee.toLocaleString("es-MX")}</span></div>
      <div class="order-row total"><span>Total</span><span>$${Math.round(total * 1.1).toLocaleString("es-MX")}</span></div>`;
  }
}

window.panelQty = (name, delta) => {
  if (!orderItems[name]) return;
  orderItems[name].qty += delta;
  playFeedback(delta > 0 ? "add" : "remove");
  if (orderItems[name].qty <= 0) {
    delete orderItems[name];
    document.querySelectorAll(".add-btn").forEach(btn => {
      if (btn.dataset.iname !== name) return;
      const qEl = document.getElementById(btn.dataset.qtyid);
      if (qEl) { qEl.classList.remove("visible"); qEl.innerHTML = ""; }
      btn.style.display = "";
    });
  } else {
    document.querySelectorAll(".add-btn").forEach(btn => {
      if (btn.dataset.iname !== name) return;
      const qEl = document.getElementById(btn.dataset.qtyid);
      if (qEl?.classList.contains("visible"))
        renderInlineQty(qEl, name, orderItems[name].price);
    });
  }
  updateCart(); saveCartToStorage();
};

// ===== ÚLTIMO PEDIDO =====
function saveLastOrder(orderNum, items, notes) {
  const keys = Object.keys(items);
  const snap = {
    orderNum, items, notes,
    total: Math.round(keys.reduce((s, k) => s + items[k].price * items[k].qty, 0) * 1.1),
    createdAt: new Date().toISOString()
  };
  try { sessionStorage.setItem("labocata_last_order", JSON.stringify(snap)); } catch(e) {}
  renderLastOrder(snap);
}

function renderLastOrder(order = null) {
  const card = document.getElementById("lastOrderCard");
  if (!card) return;
  if (!order) {
    try { const s = sessionStorage.getItem("labocata_last_order"); order = s ? JSON.parse(s) : null; } catch(e) {}
  }
  if (!order?.items || !Object.keys(order.items).length) return;
  const count = Object.keys(order.items).reduce((s, k) => s + order.items[k].qty, 0);
  const rows  = Object.keys(order.items).map(k =>
    `<li><span>${order.items[k].qty}x ${escapeHtml(order.items[k].name)}</span>
         <strong>$${(order.items[k].price * order.items[k].qty).toLocaleString("es-MX")}</strong></li>`
  ).join("");
  const date = new Date(order.createdAt).toLocaleString("es-MX",
    { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  card.innerHTML = `
    <span class="last-order-kicker">Orden ${order.orderNum} · ${date}</span>
    <h3>${count} item${count !== 1 ? "s" : ""} guardado${count !== 1 ? "s" : ""}</h3>
    <ul class="last-order-list">${rows}</ul>
    <div class="last-order-total"><span>Total con servicio</span>
      <strong>$${order.total.toLocaleString("es-MX")}</strong></div>`;
}

function repeatLastOrder() {
  try {
    const s = sessionStorage.getItem("labocata_last_order");
    if (!s) { showToast("Sin pedido previo"); return; }
    const last = JSON.parse(s);
    clearCartUI();
    orderItems = JSON.parse(JSON.stringify(last.items || {}));
    saveCartToStorage(); updateCart(); restoreCartUI();
    toggleOrder(true); playFeedback("success");
  } catch(e) { console.error("repeatLastOrder:", e); }
}

function clearCartUI() {
  document.querySelectorAll(".qty-ctrl").forEach(el => { el.classList.remove("visible"); el.innerHTML = ""; });
  document.querySelectorAll(".add-btn").forEach(btn => { btn.style.display = ""; });
}

// ===== CONFIRMAR ORDEN =====
window.confirmOrder = async () => {
  const keys = Object.keys(orderItems);
  if (!keys.length) return;

  const phoneCheck = document.getElementById("customerPhone")?.value.trim() || "";
  if (!phoneCheck) {
    alert("Por favor ingresa tu número de teléfono para avisarte cuando tu pedido esté listo.");
    document.getElementById("customerPhone")?.focus();
    return;
  }

  const confirmBtn = document.getElementById("confirmBtn");
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = "Enviando…"; }

  const orderNum        = "BOC-" + Math.floor(Math.random() * 9000 + 1000);
  const notes           = document.getElementById("orderNotes")?.value || "";
  const orderType       = document.getElementById("btnDelivery")?.classList.contains("active") ? "delivery" : "pickup";
  const customerName    = document.getElementById("deliveryName")?.value    || "";
  const customerPhone   = document.getElementById("customerPhone")?.value   || "";
  const deliveryAddress = document.getElementById("deliveryAddress")?.value || "";
  const orderSnapshot   = JSON.parse(JSON.stringify(orderItems));

  // Guardar en Supabase
  if (window.LBOrderService) {
    try {
      const result = await window.LBOrderService.submitOrder({
        orderItems: orderSnapshot, orderNumber: orderNum,
        notes, orderType, customerName, customerPhone, deliveryAddress
      });
      if (result.success) console.log("[order] Guardado ✓", result.orderId);
      else console.warn("[order] Error Supabase:", result.error);
    } catch(e) { console.error("[order] Exception:", e); }
  }

  // Mensaje WhatsApp
  let msg = "¡Hola Labocata! 🍳 Pedido:\n\n";
  keys.forEach(k => {
    const it = orderItems[k];
    msg += `• ${it.qty}x ${it.name} — $${(it.price * it.qty).toLocaleString("es-MX")}\n`;
  });
  const total = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
  msg += `\n💰 Total (con servicio): $${Math.round(total * 1.1).toLocaleString("es-MX")}`;
  if (notes) msg += `\n📝 Notas: ${notes}`;
  msg += `\n\n#${orderNum}`;
  window.open(`https://wa.me/529210000000?text=${encodeURIComponent(msg)}`, "_blank");

  saveLastOrder(orderNum, orderSnapshot, notes);
  playFeedback("success");

  const onEl = document.getElementById("orderNum");
  if (onEl) onEl.textContent = "Orden #" + orderNum;
  const oc = document.getElementById("orderContent");
  if (oc) oc.style.display = "none";
  const os = document.getElementById("orderSuccess");
  if (os) os.classList.add("show");

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9
                 L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5
                 a8.48 8.48 0 018 8v.5z"/>
      </svg>
      Confirmar por WhatsApp`;
  }
};

// ===== RESET ORDEN =====
window.resetOrder = () => {
  orderItems = {};
  saveCartToStorage();
  clearCartUI();
  const oc = document.getElementById("orderContent");
  if (oc) { oc.style.display = "flex"; oc.style.flexDirection = "column"; oc.style.flex = "1"; oc.style.overflow = "hidden"; }
  document.getElementById("orderSuccess")?.classList.remove("show");
  const on = document.getElementById("orderNotes"); if (on) on.value = "";
  setOrderType("pickup");
  updateCart();
  toggleOrder(false);
};

function bumpBadge() {
  const b = document.getElementById("cartBadge");
  if (b) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
}

window.setOrderType = (type) => {
  const del = type === "delivery";
  document.getElementById("btnPickup")      ?.classList.toggle("active", !del);
  document.getElementById("btnDelivery")    ?.classList.toggle("active",  del);
  document.getElementById("pickupInfo")     ?.classList.toggle("show",   !del);
  document.getElementById("deliveryFields") ?.classList.toggle("show",    del);
};

window.addSpotlightOrder = () => {
  document.querySelector(".menu-spotlight .spotlight-btn.primary")?.click();
};

// ===== ANIMACIONES =====
const revealObs = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
  { threshold: 0.12 }
);

// ===== INICIO =====
document.addEventListener("DOMContentLoaded", async () => {
  if (window.self !== window.top) document.body.classList.add("is-preview");
  loadCartFromStorage();
  await renderMenu();
  renderLastOrder();
});
