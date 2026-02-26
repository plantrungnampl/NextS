import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/core";
import { getFirstQueryParamValue, isPromise } from "@/shared";

type WorkspaceInvitesSearchParams = {
  inviteLink?: string | string[];
  inviteMessage?: string | string[];
  inviteType?: string | string[];
  workspace?: string | string[];
};

type WorkspaceInvitesPageProps = {
  searchParams?: WorkspaceInvitesSearchParams | Promise<WorkspaceInvitesSearchParams>;
};

async function resolveSearchParams(
  searchParams: WorkspaceInvitesPageProps["searchParams"],
): Promise<WorkspaceInvitesSearchParams> {
  if (!searchParams) {
    return {};
  }

  if (isPromise(searchParams)) {
    return (await searchParams) ?? {};
  }

  return searchParams;
}

export default async function WorkspaceInvitesPage({ searchParams }: WorkspaceInvitesPageProps) {
  const resolved = await resolveSearchParams(searchParams);
  const workspaceSlug = getFirstQueryParamValue(resolved.workspace);
  const inviteMessage = getFirstQueryParamValue(resolved.inviteMessage);
  const inviteType = getFirstQueryParamValue(resolved.inviteType);
  const inviteLink = getFirstQueryParamValue(resolved.inviteLink);

  const params = new URLSearchParams({
    tab: "members",
  });
  if (workspaceSlug) {
    params.set("workspace", workspaceSlug);
  }
  if (inviteMessage) {
    params.set("inviteMessage", inviteMessage);
  }
  if (inviteType) {
    params.set("inviteType", inviteType);
  }
  if (inviteLink) {
    params.set("inviteLink", inviteLink);
  }

  redirect(`${APP_ROUTES.workspace.settings}?${params.toString()}`);
}
