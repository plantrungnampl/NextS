import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";

type RouteParams = {
  attachmentId: string;
};

function parseHttpUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET(
  _: Request,
  context: { params: Promise<RouteParams> },
) {
  const { attachmentId } = await context.params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: attachment, error } = await supabase
    .from("attachments")
    .select("storage_path, source_type, external_url")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!attachment || error) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const sourceType = (attachment.source_type as "file" | "url" | null) ?? "file";
  if (sourceType === "url") {
    const externalUrl = parseHttpUrl((attachment.external_url as string | null) ?? null);
    if (!externalUrl) {
      return NextResponse.json({ error: "Attachment URL is invalid." }, { status: 400 });
    }

    return NextResponse.redirect(externalUrl);
  }

  const storagePath = (attachment.storage_path as string | null) ?? null;
  if (!storagePath) {
    return NextResponse.json({ error: "Attachment file path is missing." }, { status: 400 });
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from("attachments")
    .createSignedUrl(storagePath, 60);

  if (!signedUrlData?.signedUrl || signedUrlError) {
    return NextResponse.json({ error: "Could not create download url." }, { status: 400 });
  }

  return NextResponse.redirect(signedUrlData.signedUrl);
}
