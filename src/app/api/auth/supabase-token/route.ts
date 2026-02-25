import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getClerkTokenForSupabase } from "@/lib/auth/clerk-token";

export async function GET() {
  const { getToken, userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let token: string | null = null;
  try {
    token = await getClerkTokenForSupabase(getToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Clerk token error.";
    return NextResponse.json(
      { error: `Failed to resolve Clerk token for Supabase: ${message}` },
      { status: 500 },
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "Unable to resolve Clerk token for Supabase." },
      { status: 500 },
    );
  }

  return NextResponse.json({ token });
}
