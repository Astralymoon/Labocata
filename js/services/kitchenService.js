/**
 * kitchenService.js — Labocata
 * Datos y tiempo real para el Kitchen Display System (KDS).
 * Requiere sesion de admin (RLS: solo admin puede leer/actualizar orders).
 */
(function () {
  "use strict";

  const ACTIVE_STATUSES = ["pending", "accepted", "preparing", "ready"];

  async function getActiveOrders() {
    if (!window.supabaseClient) {
      console.error("[kitchen-service] supabaseClient no disponible");
      return { success: false, error: "Sin conexion al servidor.", orders: [] };
    }

    const { data, error } = await window.supabaseClient
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[kitchen-service] Error al cargar pedidos:", error.message);
      return { success: false, error: error.message, orders: [] };
    }

    return { success: true, orders: data || [] };
  }

  async function updateOrderStatus(orderId, newStatus) {
    const { error } = await window.supabaseClient
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      console.error("[kitchen-service] Error al actualizar estado:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async function markNotified(orderId) {
    const { error } = await window.supabaseClient
      .from("orders")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      console.error("[kitchen-service] Error al marcar avisado:", error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async function getTodayStats() {
    if (!window.supabaseClient) {
      return { success: false, error: "Sin conexion al servidor.", count: 0, total: 0 };
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await window.supabaseClient
      .from("orders")
      .select("total, status")
      .gte("created_at", startOfDay.toISOString());

    if (error) {
      console.error("[kitchen-service] Error al cargar estadisticas:", error.message);
      return { success: false, error: error.message, count: 0, total: 0 };
    }

    const rows = data || [];
    const cancelled = rows.filter(r => r.status === "cancelled").length;
    const total = rows
      .filter(r => r.status !== "cancelled")
      .reduce((s, r) => s + Number(r.total || 0), 0);

    return { success: true, count: rows.length, cancelled, total };
  }

  // Suscripcion en tiempo real. onChange(payload) se llama en cualquier
  // cambio; payload.table y payload.eventType permiten distinguir, por
  // ejemplo, un pedido nuevo (orders / INSERT) de una simple actualizacion.
  // onStatus(status) informa el estado de la conexion websocket
  // ("SUBSCRIBED", "TIMED_OUT", "CHANNEL_ERROR", "CLOSED").
  function subscribeToOrders(onChange, onStatus) {
    if (!window.supabaseClient) return null;

    const channel = window.supabaseClient
      .channel("kds-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, onChange)
      .subscribe((status, err) => {
        if (err) console.error("[kitchen-service] Error de suscripcion:", err.message);
        if (onStatus) onStatus(status);
      });

    return channel;
  }

  function unsubscribe(channel) {
    if (channel && window.supabaseClient) {
      window.supabaseClient.removeChannel(channel);
    }
  }

  window.LBKitchenService = {
    ACTIVE_STATUSES,
    getActiveOrders,
    updateOrderStatus,
    markNotified,
    getTodayStats,
    subscribeToOrders,
    unsubscribe,
  };
})();
