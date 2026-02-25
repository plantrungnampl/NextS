import { NextResponse } from "next/server";
import { z } from "zod";

import { getOptionalAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

const searchSchema = z.object({
  perPage: z.coerce.number().int().min(1).max(24).default(12),
  query: z.string().trim().min(1).max(120).default("nature"),
});

type UnsplashSearchResponse = {
  results?: Array<{
    alt_description: string | null;
    color: string | null;
    id: string;
    links?: { html?: string };
    urls?: { full?: string; regular?: string; small?: string; thumb?: string };
    user?: { name?: string };
  }>;
};

export async function GET(request: Request) {
  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse({
    perPage: url.searchParams.get("perPage") ?? undefined,
    query: url.searchParams.get("query") ?? "nature",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Unsplash search query." }, { status: 400 });
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey) {
    return NextResponse.json(
      { error: "UNSPLASH_ACCESS_KEY is not configured." },
      { status: 500 },
    );
  }

  const unsplashSearchUrl = new URL("https://api.unsplash.com/search/photos");
  unsplashSearchUrl.searchParams.set("query", parsed.data.query);
  unsplashSearchUrl.searchParams.set("per_page", String(parsed.data.perPage));
  unsplashSearchUrl.searchParams.set("orientation", "landscape");
  unsplashSearchUrl.searchParams.set("content_filter", "high");

  try {
    const response = await fetch(unsplashSearchUrl, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
      method: "GET",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const bodyText = await response.text();
      return NextResponse.json(
        { error: `Unsplash request failed (${response.status}): ${bodyText.slice(0, 240)}` },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as UnsplashSearchResponse;
    const results = (payload.results ?? [])
      .filter((entry) => Boolean(entry.id && entry.urls?.regular && entry.urls?.thumb))
      .map((entry) => ({
        authorName: entry.user?.name ?? "Unsplash",
        color: entry.color ?? null,
        fullUrl: entry.urls?.full ?? entry.urls?.regular ?? "",
        htmlUrl: entry.links?.html ?? "",
        id: entry.id,
        regularUrl: entry.urls?.regular ?? "",
        thumbUrl: entry.urls?.thumb ?? entry.urls?.small ?? "",
        title: entry.alt_description ?? "Unsplash image",
      }))
      .filter((entry) => entry.regularUrl.length > 0 && entry.thumbUrl.length > 0);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[unsplash:search] request failed", error);
    return NextResponse.json({ error: "Failed to search Unsplash images." }, { status: 500 });
  }
}
