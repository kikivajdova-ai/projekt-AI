// Zkopíruj jako config.js a vyplň údaje ze Supabase (Settings → API).
// Oba údaje jsou veřejné a smí být v aplikaci. Tajné klíče (service_role) sem NIKDY nepatří.
window.APP_CONFIG = {
  supabaseUrl: 'https://<id-projektu>.supabase.co',
  supabaseAnonKey: '<anon nebo publishable klíč>',
  // Nepovinné: jiná adresa API (výchozí je <supabaseUrl>/functions/v1/api)
  apiUrl: '',
};
