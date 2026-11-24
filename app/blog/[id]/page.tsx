import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BlogView } from "@/components/BlogView";
import type { Blog } from "@/types/database";
import { attachPublicProfiles } from "@/utils/publicProfiles";
import { createClient, createPublicClient } from "@/utils/supabase/server";
import { getServerAuthContext } from "@/utils/supabase/serverAuth";

export const dynamic = "force-dynamic";

const loadPublishedBlogCached = cache(async (id: string) => {
  const supabase = createPublicClient();
  const { data: blog } = await supabase
    .from("blogs")
    .select(
      `
      *,
      seasons ( id, name, slug, leagues ( id, name, short_name, slug, logo_url ) )
    `
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!blog) return null;
  const [hydrated] = await attachPublicProfiles(supabase, [blog]);
  return hydrated ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const blog = await loadPublishedBlogCached(id);

  if (!blog) {
    return { title: "Rankr — Blog" };
  }

  const author =
    blog.author_name?.trim() || blog.profiles?.username || "Author";
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
  const [publishedBlog, auth] = await Promise.all([
    loadPublishedBlogCached(id),
    getServerAuthContext(),
  ]);

  let blog = publishedBlog;

  if (!blog && auth.user) {
    const supabase = await createClient();
    const { data: privateBlog } = await supabase
      .from("blogs")
      .select(
        `
        *,
        seasons ( id, name, slug, leagues ( id, name, short_name, slug, logo_url ) )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (privateBlog) {
      const [hydrated] = await attachPublicProfiles(supabase, [privateBlog]);
      blog = hydrated ?? null;
    }
  }

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
