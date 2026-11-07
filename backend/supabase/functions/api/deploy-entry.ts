// Vstupní soubor, který je nasazený v Supabase jako funkce `api` (přes konektor Supabase).
// Kód se načítá z GitHubu ZAMKNUTÝ na konkrétní commit, takže se nasazená verze nemůže
// sama změnit. Novou verzi nasadíš tak, že sem dáš hash nového commitu a funkci znovu nasadíš
// (spolu se souborem ../deno.json jako import map, verify_jwt = false).
// Přihlášení ověřuje sama funkce (podpis JWT přes JWKS projektu); verify_jwt = false proto,
// aby brána nezastavila CORS preflight z webové aplikace.
import { createApp } from 'https://raw.githubusercontent.com/kikivajdova-ai/projekt-AI/f918364e64c403ad187e123d7395532932a1509d/backend/supabase/functions/_shared/api/app.ts';

const app = createApp();
Deno.serve(app.fetch);
