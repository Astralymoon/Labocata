const SUPABASE_URL = "https://swidrvfxpxwawrrxulhl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3aWRydmZ4cHh3YXdycnh1bGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTU0MTMsImV4cCI6MjA5Njc3MTQxM30.Ne3_Af9I5-7dqSHnOYedMWNjyZKO_rOxuX3jxcVu9UY";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = _supabase;
