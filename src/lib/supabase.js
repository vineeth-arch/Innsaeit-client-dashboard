import { createClient } from '@supabase/supabase-js';

// Defaults wired to the live project. The publishable key is safe to ship
// in client code by design; RLS enforces all access. Env vars override.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://hocvnneblgsvtujoqhpo.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_OVEBeyzlyVtNbxqWkdbrDg_B45P9E76';

export const supabase = createClient(URL, KEY);
