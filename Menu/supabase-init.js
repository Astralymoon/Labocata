const SUPABASE_URL = "https://swidrvfxpxwawrrxulhl.supabase.co";
const SUPABASE_KEY = "sb_publishable_RcObxE3oPjMqTFeN943rFA_ojEBYyNL";
// Use the global supabase object from the CDN
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Export it globally for other scripts
window.supabaseClient = _supabase;
