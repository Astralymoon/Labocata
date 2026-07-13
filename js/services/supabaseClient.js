(function () {
  "use strict";

  if (!window.supabase) {
    console.error("[supabase-client] Supabase CDN is not loaded.");
    return;
  }

  const config = window.LB_SUPABASE_CONFIG;
  if (!config || !config.url || !config.anonKey) {
    console.error("[supabase-client] Missing Supabase configuration.");
    return;
  }

  window.supabaseClient = window.supabase.createClient(config.url, config.anonKey);
})();
