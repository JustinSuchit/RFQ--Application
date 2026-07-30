import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("Supabase URL loaded:", Boolean(supabaseUrl));
  console.log("Supabase URL prefix:", supabaseUrl?.slice(0, 8));
  console.log("Supabase anon key loaded:", Boolean(supabaseAnonKey));

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseUrl.startsWith("https://")) {
    throw new Error("Supabase URL must start with https://");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
