import { createClient } from '@supabase/supabase-js';

// Your project URL (correct)
const supabaseUrl = 'https://akiaoqreodxnuhwsouzz.supabase.co';

// IMPORTANT: with Vite, env vars must start with VITE_ and be read via import.meta.env
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Named export (this is what App.jsx imports)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
