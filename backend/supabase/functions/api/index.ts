// Vstupní bod Edge Function `api` (Deno). Veškerá logika je v _shared/.
import { createApp } from '../_shared/api/app.ts';

const app = createApp();
Deno.serve(app.fetch);
