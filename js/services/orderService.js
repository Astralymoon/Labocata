/**
 * order-service.js — Labocata
 * Guarda pedidos en Supabase (orders + order_items).
 *
 * Orden de carga en MenuV3.html:
 *   <script src="../js/config/supabase.js"></script>
 *   <script src="../js/services/supabaseClient.js"></script>
 *   <script src="../js/services/orderService.js"></script>
 *   <script src="JavaScript.js" defer></script>
 */
(function () {
  "use strict";

  const RATE_LIMIT_WINDOW_MINS = 60;
  const RATE_LIMIT_MAX = 5;

  async function buildFingerprint() {
    try {
      const raw = [navigator.language, navigator.platform,
        screen.width + "x" + screen.height,
        Intl.DateTimeFormat().resolvedOptions().timeZone].join("|");
      const buf  = new TextEncoder().encode(raw);
      const hash = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    } catch(e) {
      return "fp-" + Math.random().toString(36).slice(2, 12);
    }
  }

  function sanitize(value = "", maxLen = 500) {
    return String(value).replace(/[<>"']/g, "").trim().slice(0, maxLen);
  }

  async function checkRateLimit(fingerprint) {
    try {
      const { data, error } = await window.supabaseClient.rpc("is_rate_limited", {
        p_fingerprint: fingerprint,
        p_action:      "order_create",
        p_max_count:   RATE_LIMIT_MAX,
        p_window_mins: RATE_LIMIT_WINDOW_MINS,
      });
      if (error) { console.warn("[order-service] rate-limit:", error.message); return false; }
      return Boolean(data);
    } catch(e) { return false; }
  }

  async function logRateLimit(fingerprint) {
    try {
      await window.supabaseClient.from("rate_limit_log")
        .insert([{ fingerprint, action: "order_create" }]);
    } catch(e) {}
  }

  function validateOrder({ orderItems, orderNumber }) {
    const keys = Object.keys(orderItems || {});
    if (!keys.length)     return { valid: false, reason: "El carrito esta vacio." };
    if (keys.length > 50) return { valid: false, reason: "Demasiados articulos." };
    if (!/^BOC-\d{4}$/.test(orderNumber)) return { valid: false, reason: "Numero de orden invalido." };
    for (const key of keys) {
      const item = orderItems[key];
      if (!item.name || item.name.length > 200) return { valid: false, reason: "Nombre invalido: " + key };
      if (typeof item.price !== "number" || item.price < 0 || item.price > 99999)
        return { valid: false, reason: "Precio invalido: " + key };
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99)
        return { valid: false, reason: "Cantidad invalida: " + key };
    }
    return { valid: true };
  }

  async function submitOrder({
    orderItems,
    orderNumber,
    notes           = "",
    orderType       = "pickup",
    customerName    = "",
    customerPhone   = "",
    deliveryAddress = "",
  }) {
    if (!window.supabaseClient) {
      console.error("[order-service] supabaseClient no disponible");
      return { success: false, error: "Sin conexion al servidor." };
    }

    // Validar
    const v = validateOrder({ orderItems, orderNumber });
    if (!v.valid) return { success: false, error: v.reason };

    // Rate limit
    const fingerprint = await buildFingerprint();
    const limited = await checkRateLimit(fingerprint);
    if (limited) return { success: false, error: "Demasiados pedidos. Intenta en unos minutos." };

    // Totales
    const keys     = Object.keys(orderItems);
    const subtotal = Math.round(keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0) * 100) / 100;
    const fee      = Math.round(subtotal * 0.1 * 100) / 100;
    const total    = Math.round((subtotal + fee) * 100) / 100;

    // Insertar orden.
    // NOTA: usamos la funcion RPC create_order (SECURITY DEFINER) en vez de
    // .from("orders").insert().select().single() porque un INSERT con
    // RETURNING tambien exige que la fila pase la politica RLS de SELECT.
    // Como solo el admin puede leer "orders", un cliente anonimo real jamas
    // pasaria esa verificacion y el pedido se rechazaba con error 42501
    // ("new row violates row-level security policy"). La funcion RPC inserta
    // y devuelve el id sin pasar por esa restriccion, sin abrir la lectura
    // de pedidos a cualquiera.
    const { data: orderId, error: orderError } = await window.supabaseClient.rpc("create_order", {
      p_order_number:     sanitize(orderNumber, 20),
      p_status:           "pending",
      p_order_type:       orderType === "delivery" ? "delivery" : "pickup",
      p_customer_name:    sanitize(customerName, 100),
      p_customer_phone:   sanitize(customerPhone, 20),
      p_delivery_address: sanitize(deliveryAddress, 300),
      p_notes:            sanitize(notes, 500),
      p_subtotal:         subtotal,
      p_service_fee:      fee,
      p_total:            total,
    });

    if (orderError) {
      console.error("[order-service] Error orden:", orderError.message, "| Code:", orderError.code);
      return { success: false, error: "Error al guardar: " + orderError.message };
    }

    console.log("[order-service] Orden guardada:", orderId);

    // Insertar items
    const { error: itemsError } = await window.supabaseClient
      .from("order_items")
      .insert(keys.map(k => ({
        order_id:   orderId,
        item_name:  sanitize(orderItems[k].name, 200),
        item_price: orderItems[k].price,
        quantity:   orderItems[k].qty,
        subtotal:   Math.round(orderItems[k].price * orderItems[k].qty * 100) / 100,
      })));

    if (itemsError) {
      console.error("[order-service] Error items:", itemsError.message);
    }

    await logRateLimit(fingerprint);
    return { success: true, orderId };
  }

  window.LBOrderService = { submitOrder };
  console.log("[order-service] Listo v2 ✓");
})();
