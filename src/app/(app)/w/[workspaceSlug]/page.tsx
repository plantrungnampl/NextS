import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/core";

type WorkspacePageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function WorkspaceRootRedirectPage({ params }: WorkspacePageProps) {
  const { workspaceSlug } = await params;
  redirect(APP_ROUTES.workspace.indexBySlug(workspaceSlug));
}
