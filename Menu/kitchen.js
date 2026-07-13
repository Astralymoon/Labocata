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

  function renderCard(order) {
    const items = (order.order_items || []).map(it => `
      <li><span><span class="qty">${it.quantity}x</span> ${escapeHtml(it.item_name)}</span></li>
    `).join("");

    const isDelivery = order.order_type === "delivery";
    const customerLine = isDelivery
      ? `<div class="kds-customer">${escapeHtml(order.customer_name || "Sin nombre")} · ${escapeHtml(order.customer_phone || "")}<br>${escapeHtml(order.delivery_address || "")}</div>`
      : "";

    const notesHtml = order.notes
      ? `<div class="kds-notes">${escapeHtml(order.notes)}</div>`
      : "";

    const flow = STATUS_FLOW[order.status];
    const advanceBtn = flow
      ? `<button class="kds-btn kds-btn-advance" data-order-id="${order.id}" data-next-status="${flow.next}">${flow.label}</button>`
      : "";
    const cancelBtn = `<button class="kds-btn kds-btn-cancel" data-order-id="${order.id}" data-next-status="cancelled">Cancelar</button>`;

    return `
      <div class="kds-card" id="order-${order.id}">
        <div class="kds-card-head">
          <span class="kds-order-num">${escapeHtml(order.order_number)}</span>
          <span class="kds-order-time">${timeAgo(order.created_at)}</span>
        </div>
        <span class="kds-order-type">${isDelivery ? "Domicilio" : "Recoger"}</span>
        ${customerLine}
        <ul class="kds-items">${items}</ul>
        ${notesHtml}
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
    renderBoard(result.orders);
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
    await window.auth.requireAdmin();
    const user = await window.auth.getUser();
    if (user) document.getElementById("user-email").textContent = user.email;

    await loadAndRender();

    channel = window.LBKitchenService.subscribeToOrders((payload) => {
      scheduleRefresh();
    });

    // Refresco periodico de respaldo (por si Realtime se desconecta) y
    // para que los tiempos transcurridos de cada tarjeta se mantengan al dia.
    setInterval(loadAndRender, 30000);

    window.addEventListener("beforeunload", () => {
      window.LBKitchenService.unsubscribe(channel);
    });
  });
})();
