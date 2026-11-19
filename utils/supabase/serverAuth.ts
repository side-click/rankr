import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

export interface ServerAuthContext {
  user: {
    id: string;
    user_metadata?: Record<string, unknown>;
  } | null;
  profile: {
    username: string;
    avatar_url: string | null;
    is_admin: boolean;
  } | null;
  isAdmin: boolean;
}

export const getServerAuthContext = cache(async (): Promise<ServerAuthContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null, isAdmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user: {
      id: user.id,
      user_metadata: user.user_metadata as Record<string, unknown> | undefined,
    },
    profile: profile ?? null,
    isAdmin: Boolean(profile?.is_admin),
  };
});
