import { NextResponse } from "next/server";

import { getOptionalAuthContext } from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase";

type RouteParams = {
  workspaceId: string;
};

const WORKSPACE_LOGO_BUCKET = "workspace-logos";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(
  _: Request,
  context: { params: Promise<RouteParams> },
) {
  const { workspaceId } = await context.params;
  if (!isUuid(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });
  }

  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", authContext.userId)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("logo_path")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const logoPath = (workspace as { logo_path: string | null }).logo_path;
  if (!logoPath) {
    return NextResponse.json({ error: "Logo not found." }, { status: 404 });
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(WORKSPACE_LOGO_BUCKET)
    .createSignedUrl(logoPath, 60);

  if (!signedUrlData?.signedUrl || signedUrlError) {
    return NextResponse.json({ error: "Could not create logo url." }, { status: 400 });
  }

  return NextResponse.redirect(signedUrlData.signedUrl);
}
