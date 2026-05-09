import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export async function createServerClient() {
  const { getToken } = await auth();
  // Uses Clerk's default session token (no custom template needed) —
  // Supabase validates it via the Clerk third-party auth integration.
  const token = await getToken();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    }
  );
}

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
