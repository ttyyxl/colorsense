// Deprecated: retained for migration reference; the application now uses Firebase Auth.
import { createBrowserClient } from "@supabase/ssr";

const options = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export const isSupabaseConfigured = () => Boolean(options.supabaseUrl && options.supabaseKey);

export const createClient = () => createBrowserClient(options.supabaseUrl!, options.supabaseKey!);
