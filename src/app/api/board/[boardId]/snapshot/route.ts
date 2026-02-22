import { NextResponse } from "next/server";
import { z } from "zod";

import { getBoardSnapshotData } from "@/app/(app)/w/[workspaceSlug]/board/[boardId]/data.snapshot";

const querySchema = z.object({
  boardId: z.uuid(),
  workspaceSlug: z.string().trim().min(3).max(64),
});

export async function GET(
  request: Request,
  context: {
    params: Promise<{ boardId: string }>;
  },
) {
  const { boardId } = await context.params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    boardId,
    workspaceSlug: url.searchParams.get("workspaceSlug"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid board snapshot request." },
      { status: 400 },
    );
  }

  try {
    const data = await getBoardSnapshotData(parsed.data.workspaceSlug, parsed.data.boardId);
    return NextResponse.json({
      boardVersion: data.boardVersion,
      fetchedAt: new Date().toISOString(),
      lists: data.listsWithCards,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Board not found." }, { status: 404 });
    }

    console.error("[board-snapshot] Failed to load snapshot", error);
    return NextResponse.json(
      { error: "Failed to load board snapshot." },
      { status: 500 },
    );
  }
}
