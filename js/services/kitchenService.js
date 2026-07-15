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

  // Suscripcion en tiempo real. onChange(payload) se llama en cualquier
  // cambio; payload.table y payload.eventType permiten distinguir, por
  // ejemplo, un pedido nuevo (orders / INSERT) de una simple actualizacion.
  function subscribeToOrders(onChange) {
    if (!window.supabaseClient) return null;

    const channel = window.supabaseClient
      .channel("kds-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, onChange)
      .subscribe();

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
    subscribeToOrders,
    unsubscribe,
  };
})();
