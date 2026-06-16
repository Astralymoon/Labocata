/**
 * order-service.js  —  Labocata Fase 1
 * Guarda pedidos en Supabase antes de abrir WhatsApp.
 *
 * Incluir DESPUÉS de supabase-init.js:
 *   <script src="supabase-init.js"></script>
 *   <script src="order-service.js"></script>
 *   <script src="JavaScript.js" defer></script>
 */

(function () {
  "use strict";

  // ── Constantes ──────────────────────────────────────────────
  const RATE_LIMIT_WINDOW_MINS = 60;
  const RATE_LIMIT_MAX         = 5;

  // ── Utilidades ──────────────────────────────────────────────

  /**
   * Genera un fingerprint ligero (no personal) a partir de
   * datos disponibles en el navegador, sin recopilar IP real.
   * La IP la añade Supabase en el lado del servidor opcionalmente.
   */
  async function buildFingerprint() {
    const raw = [
      navigator.language,
      navigator.platform,
      screen.width + "x" + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join("|");

    // sha-256 del string
    const buf  = new TextEncoder().encode(raw);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32); // 32 hex chars son suficientes
  }

  /** Sanitiza texto para que no llegue HTML ni SQL al backend. */
  function sanitize(value = "", maxLen = 500) {
    return String(value)
      .replace(/[<>"']/g, "")
      .trim()
      .slice(0, maxLen);
  }

  /**
   * Verifica el rate limit.
   * Usa la función SQL `is_rate_limited` que definimos en el schema.
   * Devuelve true si el usuario YA superó el límite.
   */
  async function checkRateLimit(fingerprint) {
    try {
      const { data, error } = await window.supabaseClient.rpc("is_rate_limited", {
        p_fingerprint:  fingerprint,
        p_action:       "order_create",
        p_max_count:    RATE_LIMIT_MAX,
        p_window_mins:  RATE_LIMIT_WINDOW_MINS,
      });
      if (error) {
        console.warn("[order-service] rate-limit check error:", error.message);
        return false; // falla abierta: si no podemos consultar, dejamos pasar
      }
      return Boolean(data);
    } catch (e) {
      console.warn("[order-service] rate-limit exception:", e);
      return false;
    }
  }

  /** Registra el intento en rate_limit_log. */
  async function logRateLimit(fingerprint) {
    try {
      await window.supabaseClient.from("rate_limit_log").insert([{
        fingerprint,
        action: "order_create",
      }]);
    } catch (e) {
      console.warn("[order-service] log rate-limit error:", e);
    }
  }

  // ── Validación de pedido ─────────────────────────────────────

  /**
   * Valida el payload antes de enviarlo.
   * Devuelve { valid: true } o { valid: false, reason: "..." }
   */
  function validateOrder({ orderItems, orderNumber }) {
    const keys = Object.keys(orderItems || {});

    if (keys.length === 0) {
      return { valid: false, reason: "El carrito está vacío." };
    }
    if (keys.length > 50) {
      return { valid: false, reason: "Demasiados artículos en el pedido." };
    }
    if (!/^BOC-\d{4}$/.test(orderNumber)) {
      return { valid: false, reason: "Número de orden inválido." };
    }

    for (const key of keys) {
      const item = orderItems[key];
      if (!item.name || typeof item.name !== "string" || item.name.length > 200) {
        return { valid: false, reason: "Nombre de artículo inválido: " + key };
      }
      if (typeof item.price !== "number" || item.price < 0 || item.price > 99999) {
        return { valid: false, reason: "Precio inválido: " + key };
      }
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) {
        return { valid: false, reason: "Cantidad inválida: " + key };
      }
    }

    return { valid: true };
  }

  // ── Guardado principal ───────────────────────────────────────

  /**
   * submitOrder — guarda el pedido en Supabase.
   *
   * @param {object} params
   * @param {object} params.orderItems   — estado actual del carrito
   * @param {string} params.orderNumber  — "BOC-XXXX"
   * @param {string} params.notes        — notas de cocina
   * @param {string} params.orderType    — "pickup" | "delivery"
   * @param {string} [params.customerName]
   * @param {string} [params.customerPhone]
   * @param {string} [params.deliveryAddress]
   *
   * @returns {Promise<{ success: boolean, orderId?: string, error?: string }>}
   */
  async function submitOrder({
    orderItems,
    orderNumber,
    notes        = "",
    orderType    = "pickup",
    customerName = "",
    customerPhone = "",
    deliveryAddress = "",
  }) {
    // 1. Validar
    const validation = validateOrder({ orderItems, orderNumber });
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // 2. Rate limit
    const fingerprint = await buildFingerprint();
    const limited = await checkRateLimit(fingerprint);
    if (limited) {
      return {
        success: false,
        error: "Demasiados pedidos en poco tiempo. Intenta en unos minutos.",
      };
    }

    // 3. Calcular totales
    const keys     = Object.keys(orderItems);
    const subtotal = keys.reduce((s, k) => s + orderItems[k].price * orderItems[k].qty, 0);
    const fee      = Math.round(subtotal * 0.1 * 100) / 100;
    const total    = Math.round((subtotal + fee) * 100) / 100;

    // 4. Insertar orden
    const { data: orderData, error: orderError } = await window.supabaseClient
      .from("orders")
      .insert([{
        order_number:     sanitize(orderNumber, 20),
        status:           "pending",
        order_type:       orderType === "delivery" ? "delivery" : "pickup",
        customer_name:    sanitize(customerName, 100),
        customer_phone:   sanitize(customerPhone, 20),
        delivery_address: sanitize(deliveryAddress, 300),
        notes:            sanitize(notes, 500),
        subtotal,
        service_fee:      fee,
        total,
      }])
      .select("id")
      .single();

    if (orderError) {
      console.error("[order-service] insert order error:", orderError);
      return { success: false, error: "No se pudo guardar el pedido. Intenta de nuevo." };
    }

    const orderId = orderData.id;

    // 5. Insertar items
    const itemsPayload = keys.map((k) => ({
      order_id:   orderId,
      item_name:  sanitize(orderItems[k].name, 200),
      item_price: orderItems[k].price,
      quantity:   orderItems[k].qty,
      subtotal:   Math.round(orderItems[k].price * orderItems[k].qty * 100) / 100,
    }));

    const { error: itemsError } = await window.supabaseClient
      .from("order_items")
      .insert(itemsPayload);

    if (itemsError) {
      console.error("[order-service] insert items error:", itemsError);
      // El pedido ya quedó guardado; los items fallaron.
      // No bloqueamos el flujo del cliente — el admin puede ver la orden sin items.
      // Se podría agregar un campo "items_saved: false" en la orden si se necesita.
    }

    // 6. Registrar rate limit (después de éxito)
    await logRateLimit(fingerprint);

    return { success: true, orderId };
  }

  // Exponer al scope global para que JavaScript.js lo use
  window.LBOrderService = { submitOrder };
})();
