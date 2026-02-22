import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/core";

type WorkspaceBoardsRedirectPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function WorkspaceBoardsRemovedPage({ params }: WorkspaceBoardsRedirectPageProps) {
  const { workspaceSlug } = await params;
  redirect(APP_ROUTES.workspace.indexBySlug(workspaceSlug));
}
