import { NextResponse } from "next/server";
import { z } from "zod";

import { searchWorkspaceContent } from "@/app/(app)/w/search/search-service";
import { requireAuthContext } from "@/lib/auth/server";

const querySchema = z.object({
  cursor: z.string().trim().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search request." }, { status: 400 });
  }

  try {
    const { userId } = await requireAuthContext();
    const rawSearchParams = new URLSearchParams(url.searchParams.toString());
    rawSearchParams.delete("cursor");
    rawSearchParams.delete("limit");

    const data = await searchWorkspaceContent({
      cursor: parsed.data.cursor ?? null,
      limit: parsed.data.limit,
      rawSearchParams,
      userId,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    console.error("[search:workspace] failed", error);
    return NextResponse.json({ error: "Failed to search workspace content." }, { status: 500 });
  }
}
