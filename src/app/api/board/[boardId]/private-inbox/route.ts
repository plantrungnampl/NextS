import { NextResponse } from "next/server";
import { z } from "zod";

import { getBoardPrivateInboxData } from "@/app/(app)/w/[workspaceSlug]/board/[boardId]/data.private-inbox-api";

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
      { error: "Invalid board private inbox request." },
      { status: 400 },
    );
  }

  try {
    const data = await getBoardPrivateInboxData(parsed.data.workspaceSlug, parsed.data.boardId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Board not found." }, { status: 404 });
    }

    console.error("[board-private-inbox] Failed to load private inbox", error);
    return NextResponse.json(
      { error: "Failed to load board private inbox." },
      { status: 500 },
    );
  }
}
