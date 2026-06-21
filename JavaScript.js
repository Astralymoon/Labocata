// ===== NAV SCROLL =====
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  if (nav) nav.classList.toggle("scrolled", window.scrollY > 60);
});

// ===== HELPERS =====
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c])
  );
}
function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, "").trim();
}

// ===== FILTER — Platillos =====
let filterBtns = document.querySelectorAll(".filter-btn");
let catHeaders = document.querySelectorAll(".cat-header:not(.bebidas-subheader)");
let menuGrids  = document.querySelectorAll(".menu-grid:not(.bebidas-grid)");
const bebidasSection   = document.querySelector(".bebidas-section");
const bebidasFilterBar = document.getElementById("bebidasFilterBar");
const bebidasGridsEl   = document.getElementById("bebidasGrids");

function setBebidasVisible(show) {
  const val = show ? "" : "none";
  if (bebidasSection)   bebidasSection.style.display   = val;
  if (bebidasFilterBar) bebidasFilterBar.style.display = val;
  if (bebidasGridsEl)   bebidasGridsEl.style.display   = val;
}

function applyMenuFilter(btn) {
  filterBtns.forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const f = btn.dataset.filter;
  catHeaders.forEach(h => h.style.display = "");
  menuGrids.forEach(g  => g.style.display = "");
  document.querySelectorAll(".menu-item").forEach(i => i.style.display = "");
  setBebidasVisible(true);
  if (f === "all") return;
  catHeaders.forEach(h => h.style.display = h.dataset.cat === f ? "" : "none");
  menuGrids.forEach(g  => g.style.display = g.dataset.cat  === f ? "" : "none");
  document.querySelectorAll("#menuBody .menu-item").forEach(i => {
    if (i.dataset.cat !== f) i.style.display = "none";
  });
  setTimeout(() => {
    const first = document.querySelector(`.cat-header:not(.bebidas-subheader)[data-cat="${f}"]`);
    if (first) first.scrollIntoView({ behavior:"smooth", block:"start" });
  }, 50);
}

function applyDrinkFilter(btn) {
  document.querySelectorAll(".bebidas-filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const f = btn.dataset.drinkFilter;
  document.querySelectorAll(".bebidas-subheader").forEach(h => h.style.display = "");
  document.querySelectorAll(".bebidas-grid").forEach(grid => {
    const show = f === "todas" || grid.dataset.drinkCat === f;
    grid.style.display = show ? "" : "none";
    const hdr = grid.previousElementSibling;
    if (hdr && hdr.classList.contains("bebidas-subheader"))
      hdr.style.display = show ? "" : "none";
  });
}

// ===== DATA / RENDER =====
const defaultMenuTags = [
  { id:"v",     label:"Vegetariano" },
  { id:"vg",    label:"Vegano"      },
  { id:"gf",    label:"Sin gluten"  },
  { id:"s",     label:"Signature"   },
  { id:"nuevo", label:"Nuevo"       }
];
let currentMenuTags       = defaultMenuTags;
let currentWeeklyCombos   = {};
let currentCategoryMeta   = {};
let currentCategories     = [];

function parseVariants(product) {
  try {
    if (product.description && product.description.startsWith("{")) {
      const d = JSON.parse(product.description);
      return {
        desc:         d.main_description || "",
        variants:     d.variants         || [],
        tipo_bebida:  d.tipo_bebida      || null,
        special_price:d.special_price    || null,
        tags:         d.tags             || [],
        visual_style: d.visual_style     || "auto",
        featured_text:d.featured_text    || null
      };
    }
  } catch(e) {}
  return { desc: product.description||"", variants:[], tipo_bebida:null,
           special_price:null, tags:[], visual_style:"auto", featured_text:null };
}

function renderTagSpans(tags=[]) {
  const map = currentMenuTags.reduce((m,t) => { m[t.id]=t.label; return m; }, {});
  return tags.map(tag => {
    const label = map[tag] || tag;
    const cls   = currentMenuTags.some(t => t.id===tag) ? tag : "custom";
    return `<span class="item-tag ${cls}">${escapeHtml(label)}</span>`;
  }).join("");
}

function renderProductCard(product) {
  const { desc, variants, special_price, tags, visual_style, featured_text } = parseVariants(product);
  const qtyId    = `qty-prod-${product.id}`;
  const hasImage = Boolean(product.image_url);
  const isFeat   = product.featured;
  const plainName = stripHtml(product.name);

  // Determine card class
  let styleClass = "text-card";
  if      (visual_style==="featured") styleClass = "featured";
  else if (visual_style==="photo")    styleClass = "has-photo";
  else if (visual_style==="text")     styleClass = "text-card";
  else if (isFeat)                    styleClass = "featured";
  else if (hasImage)                  styleClass = "has-photo";

  // Price & initial order name
  let displayPrice   = special_price || product.price;
  let initialName    = plainName;
  if (variants.length > 0) {
    displayPrice = variants[0].price || 0;
    initialName  = `${plainName} (${variants[0].name})`;
  }

  const oldPriceHtml = (special_price && Number(product.price))
    ? `<span class="old-price">$${Number(product.price).toLocaleString("es-MX")}</span>`
    : "";

  const variantHtml = variants.length > 0
    ? `<div class="item-variants">${variants.map((v,i) =>
        `<button class="variant-btn${i===0?" active":""}"
           data-vname="${escapeHtml(v.name)}"
           data-vprice="${v.price}">
           ${escapeHtml(v.name)} ($${v.price})
         </button>`).join("")}</div>`
    : "";

  const imageHtml = (styleClass !== "text-card" && hasImage)
    ? `<div class="item-photo"><img src="${escapeHtml(product.image_url)}"
         alt="${escapeHtml(plainName)}" loading="lazy"/></div>`
    : "";

  const card = document.createElement("div");
  card.className   = `menu-item reveal ${styleClass}`;
  card.id          = `prod-${product.id}`;
  card.dataset.cat = product.category_id;

  card.innerHTML = `
    ${imageHtml}
    <div class="item-body">
      ${isFeat ? `<span class="featured-badge">✦ &nbsp;${escapeHtml(featured_text||"Recomendado")}</span>` : ""}
      <div class="item-header">
        <h3 class="item-name">${product.name}</h3>
        <div class="price-wrapper">
          ${oldPriceHtml}
          <span class="item-price${special_price?" special":""}" id="price-${product.id}">
            $${Number(displayPrice).toLocaleString("es-MX")}
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

  // Bind add button
  card.querySelector(".add-btn").addEventListener("click", function() {
    addToOrder(this, this.dataset.iname, parseFloat(this.dataset.iprice), this.dataset.qtyid);
  });

  // Bind variant buttons
  card.querySelectorAll(".variant-btn").forEach(vBtn => {
    vBtn.addEventListener("click", function() {
      this.closest(".item-variants").querySelectorAll(".variant-btn").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      const vName  = this.dataset.vname;
      const vPrice = parseFloat(this.dataset.vprice);
      card.querySelector(".item-price").textContent = `$${Number(vPrice).toLocaleString("es-MX")}`;
      const addBtn = card.querySelector(".add-btn");
      const newName = `${plainName} (${vName})`;
      addBtn.dataset.iname  = newName;
      addBtn.dataset.iprice = vPrice;
    });
  });

  return card;
}

async function renderMenu() {
  const container   = document.getElementById("menu-categories-container");
  const bebidasGrids = document.getElementById("bebidasGrids");
  if (!container) return;

  const [categories, products] = await Promise.all([
    window.supabaseClient.from("categories").select("*").order("created_at",{ascending:true}).then(r=>r.data||[]),
    window.supabaseClient.from("products").select("*").then(r=>r.data||[])
  ]);
  currentCategories = categories;

  // Parse system config
  const sysRec = products.find(p => p.name==="___SYSTEM_TAGS___");
  if (sysRec) {
    try {
      const cfg = JSON.parse(sysRec.description);
      currentMenuTags     = cfg.tags             || defaultMenuTags;
      currentWeeklyCombos = cfg.weeklyCombos     || {};
      currentCategoryMeta = cfg.categoryMetadata || {};
      const ordered = cfg.orderedCategoryIds || [];
      if (ordered.length)
        categories.sort((a,b) => {
          const ia = ordered.indexOf(a.id), ib = ordered.indexOf(b.id);
          if (ia===-1&&ib===-1) return 0;
          if (ia===-1) return 1; if (ib===-1) return -1;
          return ia-ib;
        });
    } catch(e) { console.error("system config parse error",e); }
  }

  // Rebuild filter nav
  const filterInner = document.querySelector(".filter-inner");
  if (filterInner) {
    filterInner.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className      = "filter-btn active";
    allBtn.dataset.filter = "all";
    allBtn.textContent    = "Todo el menú";
    allBtn.addEventListener("click", () => applyMenuFilter(allBtn));
    filterInner.appendChild(allBtn);

    categories.forEach(cat => {
      if (cat.name.toLowerCase().includes("bebida")) return;
      const div = document.createElement("div"); div.className = "filter-divider";
      const btn = document.createElement("button");
      btn.className      = "filter-btn";
      btn.dataset.filter = cat.id;
      btn.textContent    = cat.name;
      btn.addEventListener("click", () => applyMenuFilter(btn));
      filterInner.appendChild(div);
      filterInner.appendChild(btn);
    });

    const dietary = document.createElement("div");
    dietary.className = "filter-dietary";
    dietary.innerHTML = currentMenuTags.map(t =>
      `<span class="dietary-tag"><span class="diet-dot ${t.id}"></span>${t.label}</span>`
    ).join("");
    filterInner.appendChild(dietary);
  }

  container.innerHTML    = "";
  if (bebidasGrids) bebidasGrids.innerHTML = "";

  categories.forEach((cat, idx) => {
    const isBebidas  = cat.name.toLowerCase().includes("bebida");
    const catProds   = products.filter(p => p.category_id===cat.id && p.name!=="___SYSTEM_TAGS___");

    if (isBebidas) {
      [
        { id:"caliente", label:"Calientes"       },
        { id:"fria",     label:"Frías"            },
        { id:"jugo",     label:"Jugos & Licuados" }
      ].forEach(type => {
        const tp = catProds.filter(p => parseVariants(p).tipo_bebida===type.id);
        if (!tp.length) return;
        const hdr  = document.createElement("div");
        hdr.className   = "cat-header bebidas-subheader reveal";
        hdr.innerHTML   = `<div><span class="cat-num">Bebidas</span><h2 class="cat-title">${type.label}</h2></div>`;
        const grid = document.createElement("div");
        grid.className         = "menu-grid bebidas-grid";
        grid.dataset.drinkCat  = type.id;
        tp.forEach((p,i) => {
          const c = renderProductCard(p);
          if (i%5>0) c.classList.add(`reveal-delay-${i%5}`);
          grid.appendChild(c);
        });
        bebidasGrids.appendChild(hdr);
        bebidasGrids.appendChild(grid);
      });
      const other = catProds.filter(p => !parseVariants(p).tipo_bebida);
      if (other.length) {
        const hdr  = document.createElement("div");
        hdr.className = "cat-header bebidas-subheader reveal";
        hdr.innerHTML = `<div><span class="cat-num">Bebidas</span><h2 class="cat-title">Otras</h2></div>`;
        const grid = document.createElement("div");
        grid.className = "menu-grid bebidas-grid"; grid.dataset.drinkCat = "todas";
        other.forEach((p,i) => { const c=renderProductCard(p); if(i%5>0) c.classList.add(`reveal-delay-${i%5}`); grid.appendChild(c); });
        bebidasGrids.appendChild(hdr); bebidasGrids.appendChild(grid);
      }
    } else {
      const meta = currentCategoryMeta[cat.id] || { title:cat.name, description:"" };
      const hdr  = document.createElement("div");
      hdr.className      = "cat-header reveal";
      hdr.dataset.cat    = cat.id;
      hdr.innerHTML = `
        <div>
          <span class="cat-num">0${idx+1} — ${escapeHtml(cat.name)}</span>
          <h2 class="cat-title">${meta.title}</h2>
        </div>
        ${meta.description ? `<p class="cat-desc">${escapeHtml(meta.description)}</p>` : ""}`;
      const grid = document.createElement("div");
      grid.className  = "menu-grid";
      grid.dataset.cat = cat.id;
      catProds.forEach((p,i) => {
        const c = renderProductCard(p);
        if (i%5>0) c.classList.add(`reveal-delay-${i%5}`);
        grid.appendChild(c);
      });
      container.appendChild(hdr);
      container.appendChild(grid);
    }
  });

  // Spotlight
  const spotlightSection = document.querySelector(".menu-spotlight");
  const today = new Date().getDay();
  const combo = currentWeeklyCombos[today];
  if (combo && combo.title) {
    spotlightSection.style.display = "grid";
    document.getElementById("spotlightTitle").innerHTML       = combo.title;
    document.getElementById("spotlightDescription").textContent = combo.subtitle;
    document.getElementById("spotlightTotal").textContent      = `$${Number(combo.price).toLocaleString("es-MX")}`;
    const p1 = products.find(p=>p.id===combo.dish1);
    if (p1&&p1.image_url) document.getElementById("spotlightImageOne").src = p1.image_url;
    const primaryBtn = spotlightSection.querySelector(".spotlight-btn.primary");
    primaryBtn.textContent = "Agregar Combo";
    primaryBtn.onclick = () => addToOrder(primaryBtn, stripHtml(combo.title), Number(combo.price), "spotlight-qty");
  } else {
    const sp = products.find(p => p.featured && !categories.find(c=>c.id===p.category_id)?.name.toLowerCase().includes("bebida"));
    if (sp && spotlightSection) {
      spotlightSection.style.display = "grid";
      const { desc, special_price } = parseVariants(sp);
      const dp = special_price || sp.price;
      document.getElementById("spotlightTitle").innerHTML        = sp.name;
      document.getElementById("spotlightDescription").textContent = desc;
      document.getElementById("spotlightTotal").textContent       = `$${Number(dp).toLocaleString("es-MX")}`;
      if (sp.image_url) document.getElementById("spotlightImageOne").src = sp.image_url;
      const primaryBtn = spotlightSection.querySelector(".spotlight-btn.primary");
      primaryBtn.textContent = "Agregar Platillo";
      primaryBtn.onclick = () => addToOrder(primaryBtn, stripHtml(sp.name), Number(dp), "spotlight-qty");
    } else if (spotlightSection) {
      spotlightSection.style.display = "none";
    }
  }

  filterBtns  = document.querySelectorAll(".filter-btn");
  catHeaders  = document.querySelectorAll(".cat-header");
  menuGrids   = document.querySelectorAll(".menu-grid");
  document.querySelectorAll(".reveal").forEach(el => revealObs.observe(el));
  restoreCartUI();
}

// ===== PREVIEW =====
window.addEventListener("message", e => {
  if (e.data.type==="PREVIEW_UPDATE") previewProduct(e.data.product);
});
function previewProduct(product) {
  const existing = document.getElementById(`prod-${product.id}`);
  const newCard  = renderProductCard(product);
  newCard.classList.add("visible");
  newCard.style.cssText = "transition:none;opacity:1;transform:translateY(0)";
  if (existing) {
    if (existing.dataset.cat !== product.category_id) { existing.remove(); insertProductInGrid(newCard, product); }
    else existing.replaceWith(newCard);
  } else { insertProductInGrid(newCard, product); }
  newCard.scrollIntoView({ behavior:"smooth", block:"center" });
}
function insertProductInGrid(card, product) {
  const cat      = currentCategories.find(c=>c.id===product.category_id);
  const isBebida = cat && cat.name.toLowerCase().includes("bebida");
  const { tipo_bebida } = parseVariants(product);
  const grid = isBebida
    ? document.querySelector(`.bebidas-grid[data-drink-cat="${tipo_bebida||"todas"}"]`)
    : document.querySelector(`.menu-grid[data-cat="${product.category_id}"]`);
  if (grid) { grid.prepend(card); if (isBebida) setBebidasVisible(true); }
  else { const c=document.getElementById("menu-categories-container"); if(c) c.prepend(card); }
}

// ===== SOUND =====
const addSound = new Audio("Sounds/Click.mp3");
let audioCtx;
function playTone(kind="add") {
  try {
    audioCtx = audioCtx||new(window.AudioContext||window.webkitAudioContext)();
    const now=audioCtx.currentTime;
    const tones={add:[640,880],remove:[300,210],open:[420,540],success:[520,720,980]}[kind]||[520];
    tones.forEach((freq,i)=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type=kind==="remove"?"triangle":"sine";
      o.frequency.setValueAtTime(freq,now+i*0.055);
      g.gain.setValueAtTime(0.0001,now+i*0.055);
      g.gain.exponentialRampToValueAtTime(0.075,now+i*0.055+0.012);
      g.gain.exponentialRampToValueAtTime(0.0001,now+i*0.055+0.12);
      o.connect(g);g.connect(audioCtx.destination);
      o.start(now+i*0.055);o.stop(now+i*0.055+0.13);
    });
  } catch(e){}
}
function playFeedback(kind="add") {
  if(kind==="add"){ addSound.currentTime=0; addSound.play().catch(()=>playTone(kind)); return; }
  playTone(kind);
}

// ===== ORDER STATE =====
let orderItems = {};   // key = plain name string
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

// Re-connect qty controls after menu renders (handles page reload)
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

function showToast(name, action="agregado") {
  let toast = document.getElementById("globalToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.id = "globalToast";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${action}</span>`;
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

function addToOrder(btn, name, price, qtyId) {
  name  = stripHtml(name);          // always store plain text
  price = parseFloat(price) || 0;

  playFeedback("add");
  if (navigator.vibrate) navigator.vibrate(30);

  if (orderItems[name]) orderItems[name].qty++;
  else orderItems[name] = { name, price, qty:1 };

  const qtyEl = document.getElementById(qtyId);
  if (qtyEl) {
    btn.style.display = "none";
    qtyEl.classList.add("visible");
    renderInlineQty(qtyEl, name, price);
  }
  updateCart(); bumpBadge(); showToast(name); saveCartToStorage();
}

function renderInlineQty(el, name, price) {
  const qty = orderItems[name] ? orderItems[name].qty : 0;
  el.innerHTML = "";
  const m = document.createElement("button"); m.className="qty-btn"; m.textContent="−";
  m.addEventListener("click", ()=>changeQty(name,-1,el.id));
  const n = document.createElement("span"); n.className="qty-num"; n.textContent=qty;
  const p = document.createElement("button"); p.className="qty-btn"; p.textContent="+";
  p.addEventListener("click", ()=>changeQty(name,1,el.id));
  el.append(m,n,p);
}

window.changeQty = (name, delta, qtyId) => {
  if (!orderItems[name]) return;
  orderItems[name].qty += delta;
  playFeedback(delta>0?"add":"remove");
  if (orderItems[name].qty <= 0) {
    delete orderItems[name];
    const el = document.getElementById(qtyId);
    if (el) {
      el.classList.remove("visible"); el.innerHTML="";
      const card = el.closest(".menu-item,.bebida-item");
      if (card) { const ab=card.querySelector(".add-btn"); if(ab) ab.style.display=""; }
    }
  } else {
    const el = document.getElementById(qtyId);
    if (el) renderInlineQty(el, name, orderItems[name].price);
  }
  updateCart(); saveCartToStorage();
};

// ===== UPDATE CART PANEL =====
function updateCart() {
  const keys  = Object.keys(orderItems);
  const total = keys.reduce((s,k) => s + orderItems[k].price * orderItems[k].qty, 0);
  const count = keys.reduce((s,k) => s + orderItems[k].qty, 0);

  const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  set("cartBadge",       count);
  set("fabBadge",        count);
  set("fabAmount",       "$"+total.toLocaleString("es-MX"));
  set("orderMeterCount", `${count} item${count!==1?"s":""}`);
  set("orderMeterTotal", "$"+total.toLocaleString("es-MX"));
  set("orderMeta",       count ? `${count} item${count!==1?"s":""} en tu orden` : "Sin platillos agregados");

  const fab = document.getElementById("orderFab");
  if (fab) fab.classList.toggle("visible", count>0);

  const container = document.getElementById("orderItems");
  const empty     = document.getElementById("orderEmpty");
  const footer    = document.getElementById("orderFooter");
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

    // Build order-line matching exact CSS grid structure:
    // grid-template-columns: 34px minmax(0,1fr)
    // order-line-info has its own sub-grid: minmax(0,1fr) auto  x2 rows
    const line = document.createElement("div");
    line.className = "order-line";

    // Col 1: qty badge
    const qtyBadge = document.createElement("div");
    qtyBadge.className   = "order-line-qty";
    qtyBadge.textContent = `x${item.qty}`;

    // Col 2: info sub-grid
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

    const actions = document.createElement("div");
    actions.className = "order-line-actions";

    const btnMinus = document.createElement("button");
    btnMinus.className   = "order-qty-btn";
    btnMinus.textContent = "−";
    btnMinus.addEventListener("click", () => panelQty(key, -1));

    const qtyNum = document.createElement("span");
    qtyNum.className   = "order-qty-num";
    qtyNum.textContent = item.qty;

    const btnPlus = document.createElement("button");
    btnPlus.className   = "order-qty-btn";
    btnPlus.textContent = "+";
    btnPlus.addEventListener("click", () => panelQty(key, 1));

    actions.append(btnMinus, qtyNum, btnPlus);
    info.append(nameEl, priceEl, unitEl, actions);
    line.append(qtyBadge, info);
    container.appendChild(line);
  });

  const sub = document.getElementById("orderSubtotals");
  if (sub) {
    const fee = Math.round(total*0.1);
    sub.innerHTML = `
      <div class="order-row"><span>Subtotal</span><span>$${total.toLocaleString("es-MX")}</span></div>
      <div class="order-row"><span>Servicio (10%)</span><span>$${fee.toLocaleString("es-MX")}</span></div>
      <div class="order-row total"><span>Total</span><span>$${Math.round(total*1.1).toLocaleString("es-MX")}</span></div>`;
  }
}

window.panelQty = (name, delta) => {
  if (!orderItems[name]) return;
  orderItems[name].qty += delta;
  playFeedback(delta>0?"add":"remove");
  if (orderItems[name].qty <= 0) {
    delete orderItems[name];
    // Restore add button on menu card
    document.querySelectorAll(".add-btn").forEach(btn => {
      if (btn.dataset.iname !== name) return;
      const qEl = document.getElementById(btn.dataset.qtyid);
      if (qEl) { qEl.classList.remove("visible"); qEl.innerHTML=""; }
      btn.style.display = "";
    });
  } else {
    // Sync inline qty control on menu card
    document.querySelectorAll(".add-btn").forEach(btn => {
      if (btn.dataset.iname !== name) return;
      const qEl = document.getElementById(btn.dataset.qtyid);
      if (qEl && qEl.classList.contains("visible"))
        renderInlineQty(qEl, name, orderItems[name].price);
    });
  }
  updateCart(); saveCartToStorage();
};

// ===== LAST ORDER =====
function saveLastOrder(orderNum, items, notes) {
  const keys = Object.keys(items);
  const snap = {
    orderNum, items, notes,
    total: Math.round(keys.reduce((s,k)=>s+items[k].price*items[k].qty,0)*1.1),
    createdAt: new Date().toISOString()
  };
  try { sessionStorage.setItem("labocata_last_order", JSON.stringify(snap)); } catch(e) {}
  renderLastOrder(snap);
}

function renderLastOrder(order=null) {
  const card = document.getElementById("lastOrderCard");
  if (!card) return;
  if (!order) {
    try { const s=sessionStorage.getItem("labocata_last_order"); order=s?JSON.parse(s):null; } catch(e) {}
  }
  if (!order||!order.items||!Object.keys(order.items).length) return;
  const count = Object.keys(order.items).reduce((s,k)=>s+order.items[k].qty,0);
  const rows  = Object.keys(order.items).map(k=>
    `<li><span>${order.items[k].qty}x ${escapeHtml(order.items[k].name)}</span>
         <strong>$${(order.items[k].price*order.items[k].qty).toLocaleString("es-MX")}</strong></li>`
  ).join("");
  const date = new Date(order.createdAt).toLocaleString("es-MX",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
  card.innerHTML=`
    <span class="last-order-kicker">Orden ${order.orderNum} · ${date}</span>
    <h3>${count} item${count!==1?"s":""} guardado${count!==1?"s":""}</h3>
    <ul class="last-order-list">${rows}</ul>
    <div class="last-order-total"><span>Total con servicio</span><strong>$${order.total.toLocaleString("es-MX")}</strong></div>`;
}

function repeatLastOrder() {
  try {
    const s = sessionStorage.getItem("labocata_last_order");
    if (!s) { showToast("Sin pedido previo"); return; }
    const last = JSON.parse(s);
    clearCartUI();
    orderItems = JSON.parse(JSON.stringify(last.items||{}));
    saveCartToStorage();
    updateCart();
    restoreCartUI();
    toggleOrder(true);
    playFeedback("success");
  } catch(e) { console.error("repeatLastOrder",e); }
}

function clearCartUI() {
  document.querySelectorAll(".qty-ctrl").forEach(el => { el.classList.remove("visible"); el.innerHTML=""; });
  document.querySelectorAll(".add-btn").forEach(btn => { btn.style.display=""; });
}

// ===== CONFIRM ORDER =====
window.confirmOrder = async () => {
  const keys = Object.keys(orderItems);
  if (!keys.length) return;

  const confirmBtn = document.getElementById("confirmBtn");
  if (confirmBtn) { confirmBtn.disabled=true; confirmBtn.textContent="Enviando…"; }

  const orderNum       = "BOC-"+Math.floor(Math.random()*9000+1000);
  const notes          = document.getElementById("orderNotes")?.value||"";
  const orderType      = document.getElementById("btnDelivery")?.classList.contains("active")?"delivery":"pickup";
  const customerName   = document.getElementById("deliveryName")?.value||"";
  const customerPhone  = document.getElementById("deliveryPhone")?.value||"";
  const deliveryAddress= document.getElementById("deliveryAddress")?.value||"";
  const orderSnapshot  = JSON.parse(JSON.stringify(orderItems));

  // Save to Supabase
  if (window.LBOrderService) {
    try {
      const result = await window.LBOrderService.submitOrder({
        orderItems: orderSnapshot, orderNumber: orderNum,
        notes, orderType, customerName, customerPhone, deliveryAddress
      });
      if (!result.success) console.warn("[order] No se guardó en Supabase:", result.error);
      else console.log("[order] Guardado en Supabase ✓", result.orderId);
    } catch(e) { console.error("[order] Exception Supabase:", e); }
  }

  // WhatsApp message
  let msg = "¡Hola Labocata! 🍳 Pedido:\n\n";
  keys.forEach(k => {
    msg += `• ${orderItems[k].qty}x ${orderItems[k].name} — $${(orderItems[k].price*orderItems[k].qty).toLocaleString("es-MX")}\n`;
  });
  const total = keys.reduce((s,k)=>s+orderItems[k].price*orderItems[k].qty,0);
  msg += `\n💰 Total (con servicio): $${Math.round(total*1.1).toLocaleString("es-MX")}`;
  if (notes) msg += `\n📝 Notas: ${notes}`;
  msg += `\n\n#${orderNum}`;
  window.open(`https://wa.me/529210000000?text=${encodeURIComponent(msg)}`, "_blank");

  saveLastOrder(orderNum, orderSnapshot, notes);
  playFeedback("success");

  set_id("orderNum", "Orden #"+orderNum);
  const oc = document.getElementById("orderContent");
  if (oc) oc.style.display = "none";
  const os = document.getElementById("orderSuccess");
  if (os) os.classList.add("show");

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
      </svg>
      Confirmar por WhatsApp`;
  }
};

function set_id(id, text) { const el=document.getElementById(id); if(el) el.textContent=text; }

// ===== RESET ORDER =====
window.resetOrder = () => {
  orderItems = {};
  saveCartToStorage();
  clearCartUI();

  const oc = document.getElementById("orderContent");
  if (oc) {
    oc.style.display       = "flex";
    oc.style.flexDirection = "column";
    oc.style.flex          = "1";
    oc.style.overflow      = "hidden";
  }
  const os = document.getElementById("orderSuccess");
  if (os) os.classList.remove("show");

  const on = document.getElementById("orderNotes");
  if (on) on.value = "";

  setOrderType("pickup");
  updateCart();
  toggleOrder(false);
};

function bumpBadge() {
  const b = document.getElementById("cartBadge");
  if (b) { b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump"); }
}

window.setOrderType = (type) => {
  const isDelivery = type==="delivery";
  document.getElementById("btnPickup")   ?.classList.toggle("active", !isDelivery);
  document.getElementById("btnDelivery") ?.classList.toggle("active",  isDelivery);
  document.getElementById("pickupInfo")  ?.classList.toggle("show",   !isDelivery);
  document.getElementById("deliveryFields")?.classList.toggle("show",  isDelivery);
};

window.addSpotlightOrder = () => {
  const btn = document.querySelector(".menu-spotlight .spotlight-btn.primary");
  if (btn && btn.onclick) btn.onclick();
};

// ===== ANIMATIONS =====
const revealObs = new IntersectionObserver(
  entries => entries.forEach(e => { if(e.isIntersecting) e.target.classList.add("visible"); }),
  { threshold:0.12 }
);

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  if (window.self !== window.top) document.body.classList.add("is-preview");
  loadCartFromStorage();
  await renderMenu();
  renderLastOrder();
});
