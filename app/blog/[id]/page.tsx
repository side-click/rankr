import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";
import { BlogView } from "@/components/BlogView";
import type { Blog } from "@/types/database";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: blog } = await supabase
    .from("blogs")
    .select(
      `
      title,
      subtitle,
      banner_url,
      author_name,
      season_name_snapshot,
      league_name_snapshot,
      profiles ( username ),
      seasons ( name, leagues ( name, short_name ) )
    `
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!blog) {
    return { title: "Rankr — Blog" };
  }

  const profile = Array.isArray(blog.profiles)
    ? blog.profiles[0]
    : blog.profiles;
  const author = blog.author_name?.trim() || profile?.username || "Author";
  const description =
    blog.subtitle?.trim() || `Published by ${author} on Rankr`;

  return {
    title: `${blog.title} — Rankr`,
    description,
    openGraph: {
      title: blog.title,
      description,
      type: "article",
      ...(blog.banner_url ? { images: [{ url: blog.banner_url }] } : {}),
    },
    twitter: {
      card: blog.banner_url ? "summary_large_image" : "summary",
      title: blog.title,
      description,
      ...(blog.banner_url ? { images: [blog.banner_url] } : {}),
    },
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [supabase, auth] = await Promise.all([
    createClient(),
    getServerAuthContext(),
  ]);

  const { data: blog } = await supabase
    .from("blogs")
    .select(
      `
      *,
      profiles ( id, username, avatar_url ),
      seasons ( id, name, slug, leagues ( id, name, short_name, slug, logo_url ) )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!blog) {
    notFound();
  }

  const isOwner = Boolean(auth.user && auth.user.id === blog.user_id);
  const isAdmin = auth.isAdmin;

  if (blog.status !== "published" && !isOwner && !isAdmin) {
    notFound();
  }

  return (
    <BlogView
      blog={blog as unknown as Blog}
      isOwner={isOwner}
      isAdmin={isAdmin}
    />
  );
}
