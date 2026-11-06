// Vstupní soubor, který je nasazený v Supabase jako funkce `api` (přes konektor Supabase).
// Kód se načítá z GitHubu ZAMKNUTÝ na konkrétní commit, takže se nasazená verze nemůže
// sama změnit. Novou verzi nasadíš tak, že sem dáš hash nového commitu a funkci znovu nasadíš
// (spolu se souborem ../deno.json jako import map, verify_jwt = false).
// Přihlášení ověřuje sama funkce (podpis JWT přes JWKS projektu); verify_jwt = false proto,
// aby brána nezastavila CORS preflight z webové aplikace.
import { createApp } from 'https://raw.githubusercontent.com/kikivajdova-ai/projekt-AI/fae8910e77ed36f7748b398a3d7974745a30f15a/backend/supabase/functions/_shared/api/app.ts';

const app = createApp();
Deno.serve(app.fetch);
