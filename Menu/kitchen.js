(function () {
  "use strict";

  const STATUS_FLOW = {
    pending:   { next: "accepted",  label: "Aceptar" },
    accepted:  { next: "preparing", label: "Empezar a preparar" },
    preparing: { next: "ready",     label: "Marcar listo" },
    ready:     { next: "completed", label: "Entregar / Completar" },
  };

  let channel = null;
  let refreshTimer = null;
  let audioCtx = null;
  let lastOrders = [];

  function playNewOrderChime() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const notes = [660, 880, 1100]; // campanita ascendente, distinta al "add" del menu
      notes.forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, now + i * 0.14);
        g.gain.setValueAtTime(0.0001, now + i * 0.14);
        g.gain.exponentialRampToValueAtTime(0.22, now + i * 0.14 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 0.32);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(now + i * 0.14);
        o.stop(now + i * 0.14 + 0.34);
      });
    } catch (e) { console.warn("[kitchen] No se pudo reproducir el sonido:", e); }
  }

  function escapeHtml(v = "") {
    return String(v).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
    );
  }

  function timeAgo(iso) {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "recien";
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}min`;
  }

  // Semaforo por tiempo transcurrido: verde 0-5 min, amarillo 5-30 min, rojo 30+ min.
  function urgencyLevel(iso) {
    const mins = (Date.now() - new Date(iso).getTime()) / 60000;
    if (mins < 5) return "ok";
    if (mins < 30) return "warn";
    return "late";
  }

  function renderCard(order) {
    const items = (order.order_items || []).map(it => `
      <li>
        <span><span class="qty">${it.quantity}x</span> ${escapeHtml(it.item_name)}</span>
        ${it.notes ? `<div class="kds-item-note">✏️ ${escapeHtml(it.notes)}</div>` : ""}
      </li>
    `).join("");

    const isDelivery = order.order_type === "delivery";
    const customerLine = isDelivery
      ? `<div class="kds-customer">${escapeHtml(order.customer_name || "Sin nombre")} · ${escapeHtml(order.customer_phone || "")}<br>${escapeHtml(order.delivery_address || "")}</div>`
      : "";

    const notesHtml = order.notes
      ? `<div class="kds-notes">${escapeHtml(order.notes)}</div>`
      : "";

    const urgency = urgencyLevel(order.created_at);
    const flow = STATUS_FLOW[order.status];
    const advanceBtn = flow
      ? `<button class="kds-btn kds-btn-advance" data-order-id="${order.id}" data-next-status="${flow.next}">${flow.label}</button>`
      : "";
    const cancelBtn = `<button class="kds-btn kds-btn-cancel" data-order-id="${order.id}" data-next-status="cancelled">Cancelar</button>`;

    const notifyHtml = order.status === "ready"
      ? (order.notified_at
          ? `<div class="kds-notified-badge">✓ Cliente avisado</div>`
          : `<button class="kds-btn kds-btn-notify" data-notify-id="${order.id}">📣 Avisar cliente</button>`)
      : "";

    return `
      <div class="kds-card kds-urgency-${urgency}" id="order-${order.id}">
        <div class="kds-card-head">
          <span class="kds-order-num">${escapeHtml(order.order_number)}</span>
          <span class="kds-order-time kds-urgency-badge-${urgency}">${timeAgo(order.created_at)}</span>
        </div>
        <span class="kds-order-type">${isDelivery ? "Domicilio" : "Recoger"}</span>
        ${customerLine}
        <ul class="kds-items">${items}</ul>
        ${notesHtml}
        ${notifyHtml}
        <div class="kds-actions">${advanceBtn}${cancelBtn}</div>
      </div>
    `;
  }

  function renderBoard(orders) {
    const byStatus = { pending: [], accepted: [], preparing: [], ready: [] };
    orders.forEach(o => { if (byStatus[o.status]) byStatus[o.status].push(o); });

    Object.keys(byStatus).forEach(status => {
      const col = document.getElementById(`col-${status}`);
      const countEl = document.getElementById(`count-${status}`);
      const list = byStatus[status];
      countEl.textContent = list.length;
      col.innerHTML = list.length
        ? list.map(renderCard).join("")
        : `<div class="kds-empty">Sin pedidos</div>`;
    });

    document.querySelectorAll(".kds-btn[data-order-id]").forEach(btn => {
      btn.addEventListener("click", onAdvanceClick);
    });
    document.querySelectorAll(".kds-btn-notify[data-notify-id]").forEach(btn => {
      btn.addEventListener("click", onNotifyClick);
    });
  }

  function buildTicketHtml(order) {
    const isDelivery = order.order_type === "delivery";
    const fecha = new Date(order.created_at).toLocaleString("es-MX", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });

    const itemsHtml = (order.order_items || []).map(it => `
      <div class="pt-row">
        <span>${it.quantity}x ${escapeHtml(it.item_name)}</span>
        <span>$${Number(it.subtotal).toLocaleString("es-MX")}</span>
      </div>
      <div class="pt-note pt-unit">$${Number(it.item_price).toLocaleString("es-MX")} c/u</div>
      ${it.notes ? `<div class="pt-note">* ${escapeHtml(it.notes)}</div>` : ""}
    `).join("");

    const customerHtml = isDelivery
      ? `<div>${escapeHtml(order.customer_name || "")}</div>
         <div>${escapeHtml(order.customer_phone || "")}</div>
         <div>${escapeHtml(order.delivery_address || "")}</div>`
      : `<div class="pt-center">PARA RECOGER</div>`;

    return `
      <div class="pt-center pt-title">LABOCATA</div>
      <div class="pt-center">${escapeHtml(order.order_number)}</div>
      <div class="pt-center">${fecha}</div>
      <div class="pt-line"></div>
      <div class="pt-center">${isDelivery ? "DOMICILIO" : "RECOGER"}</div>
      ${customerHtml}
      <div class="pt-line"></div>
      ${itemsHtml}
      <div class="pt-line"></div>
      <div class="pt-row"><span>Subtotal</span><span>$${Number(order.subtotal).toLocaleString("es-MX")}</span></div>
      <div class="pt-row"><span>Servicio</span><span>$${Number(order.service_fee).toLocaleString("es-MX")}</span></div>
      <div class="pt-row pt-title"><span>TOTAL</span><span>$${Number(order.total).toLocaleString("es-MX")}</span></div>
      ${order.notes ? `<div class="pt-line"></div><div class="pt-notes-box"><strong>NOTA DEL CLIENTE:</strong><br>${escapeHtml(order.notes)}</div>` : ""}
    `;
  }

  function printTicket(order) {
    const area = document.getElementById("printArea");
    area.innerHTML = buildTicketHtml(order);
    window.print();
  }

  function buildCustomerWhatsAppUrl(order) {
    const digits = String(order.customer_phone || "").replace(/\D/g, "");
    if (!digits) return null;
    // Numero mexicano a 10 digitos -> anteponer codigo de pais 52.
    const phone = digits.length === 10 ? "52" + digits : digits;

    const message = order.order_type === "delivery"
      ? `¡Hola! Hemos completado su pedido ${order.order_number}, nuestro repartidor va en camino. 🛵`
      : `¡Hola! Su pedido ${order.order_number} está listo, pase a la sucursal asignada para recogerlo. 🥐`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  async function onNotifyClick(e) {
    const btn = e.currentTarget;
    const orderId = btn.dataset.notifyId;
    btn.disabled = true;

    // Abrimos la pestaña YA (sincrono, dentro del clic) para que el navegador
    // no la bloquee como popup; la llenamos despues de guardar en Supabase.
    const waWindow = window.open("", "_blank");

    const result = await window.LBKitchenService.markNotified(orderId);
    if (!result.success) {
      alert("No se pudo marcar como avisado: " + result.error);
      btn.disabled = false;
      if (waWindow) waWindow.close();
      return;
    }
    const order = lastOrders.find(o => String(o.id) === String(orderId));
    if (order) {
      printTicket(order);
      const waUrl = buildCustomerWhatsAppUrl(order);
      if (waUrl && waWindow) {
        waWindow.location.href = waUrl;
      } else if (waWindow) {
        waWindow.close();
        alert("Este pedido no tiene teléfono guardado, no se pudo abrir WhatsApp.");
      }
    }
    await loadAndRender();
  }

  async function onAdvanceClick(e) {
    const btn = e.currentTarget;
    const orderId = btn.dataset.orderId;
    const nextStatus = btn.dataset.nextStatus;
    btn.disabled = true;
    const result = await window.LBKitchenService.updateOrderStatus(orderId, nextStatus);
    if (!result.success) {
      alert("No se pudo actualizar el pedido: " + result.error);
      btn.disabled = false;
      return;
    }
    await loadAndRender();
  }

  async function loadAndRender() {
    const result = await window.LBKitchenService.getActiveOrders();
    if (!result.success) {
      console.error("[kitchen] Error al cargar:", result.error);
      return;
    }
    lastOrders = result.orders;
    renderBoard(result.orders);
  }

  async function loadStats() {
    const stats = await window.LBKitchenService.getTodayStats();
    if (!stats.success) return;
    document.getElementById("statsCount").textContent = stats.count;
    document.getElementById("statsTotal").textContent = "$" + stats.total.toLocaleString("es-MX");
  }

  function scheduleRefresh() {
    // Pequeno debounce: varios cambios seguidos disparan un solo refetch.
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadAndRender, 300);
  }

  function setLiveStatus(connected) {
    const dot = document.getElementById("liveDot");
    const label = document.getElementById("liveLabel");
    if (!dot || !label) return;
    dot.style.background = connected ? "#4a7c59" : "#a5433a";
    label.textContent = connected ? "En vivo" : "Reconectando…";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // Los navegadores bloquean audio hasta el primer gesto del usuario;
    // esto lo "desbloquea" en cuanto el admin toca la pantalla.
    const unlockAudio = () => {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      document.removeEventListener("click", unlockAudio);
    };
    document.addEventListener("click", unlockAudio);

    await window.auth.requireAdmin();
    const user = await window.auth.getUser();
    if (user) document.getElementById("user-email").textContent = user.email;

    await loadAndRender();
    await loadStats();

    channel = window.LBKitchenService.subscribeToOrders((payload) => {
      if (payload.table === "orders" && payload.eventType === "INSERT") {
        playNewOrderChime();
        const board = document.getElementById("kdsBoard");
        board.classList.add("kds-new-order-pulse");
        setTimeout(() => board.classList.remove("kds-new-order-pulse"), 900);
      }
      scheduleRefresh();
      loadStats();
    });

    // Refresco periodico de respaldo (por si Realtime se desconecta) y
    // para que los tiempos transcurridos de cada tarjeta se mantengan al dia.
    setInterval(() => { loadAndRender(); loadStats(); }, 30000);

    window.addEventListener("beforeunload", () => {
      window.LBKitchenService.unsubscribe(channel);
    });
  });
})();
