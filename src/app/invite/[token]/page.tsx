import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SubmitButton,
} from "@/components/ui";
import { APP_ROUTES } from "@/core";
import { hashInviteToken, isInviteExpired } from "@/lib/invites";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getFirstQueryParamValue, isPromise } from "@/shared";

import { acceptInvite } from "./actions";

type InvitePageParams = {
  token: string;
};

type InvitePageSearchParams = {
  message?: string | string[];
  type?: string | string[];
};

type InvitePageProps = {
  params: InvitePageParams | Promise<InvitePageParams>;
  searchParams?: InvitePageSearchParams | Promise<InvitePageSearchParams>;
};

type InviteRecord = {
  accepted_at: string | null;
  expires_at: string;
  id: string;
  invited_email: string;
  invited_role: "owner" | "admin" | "member";
  status: "pending" | "accepted" | "revoked" | "expired";
  workspace_id: string;
};

async function resolveParams(
  params: InvitePageProps["params"],
): Promise<InvitePageParams> {
  if (isPromise(params)) {
    return await params;
  }

  return params;
}

async function resolveSearchParams(
  searchParams: InvitePageProps["searchParams"],
): Promise<InvitePageSearchParams> {
  if (!searchParams) {
    return {};
  }

  if (isPromise(searchParams)) {
    return (await searchParams) ?? {};
  }

  return searchParams;
}

function withLoginRedirect(token: string): string {
  const searchParams = new URLSearchParams({
    next: APP_ROUTES.inviteByToken(token),
  });
  return `${APP_ROUTES.login}?${searchParams.toString()}`;
}

function getInviteStatusLabel(invite: InviteRecord): string {
  if (invite.status === "accepted") {
    return "Accepted";
  }

  if (invite.status === "revoked") {
    return "Revoked";
  }

  if (invite.status === "expired") {
    return "Expired";
  }

  return isInviteExpired(invite.expires_at) ? "Expired" : "Pending";
}

function canAcceptInvite(invite: InviteRecord): boolean {
  return invite.status === "pending" && !isInviteExpired(invite.expires_at);
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await resolveParams(params);
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const statusMessage = getFirstQueryParamValue(resolvedSearchParams.message);
  const statusType = getFirstQueryParamValue(resolvedSearchParams.type);
  const isErrorMessage = statusType !== "success";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(withLoginRedirect(token));
  }

  const tokenHash = hashInviteToken(token);
  const { data } = await supabase
    .from("invites")
    .select("id, invited_email, invited_role, status, expires_at, accepted_at, workspace_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const invite = (data ?? null) as InviteRecord | null;

  if (!invite) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Invite unavailable</CardTitle>
          <CardDescription>
            This invite link is invalid, expired, revoked, or does not belong to your current account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href={APP_ROUTES.workspace.index}>
            <Button className="w-full" type="button">
              Go to workspace dashboard
            </Button>
          </Link>
          <p className="text-sm text-slate-600">
            Need another account?{" "}
            <Link
              className="font-medium text-sky-700 underline-offset-2 hover:underline"
              href={withLoginRedirect(token)}
            >
              Switch login
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("id", invite.workspace_id)
    .maybeSingle();
  const workspaceSlug = (workspace as { slug: string } | null)?.slug;
  const workspaceHref = workspaceSlug
    ? APP_ROUTES.workspace.invitesBySlug(workspaceSlug)
    : APP_ROUTES.workspace.index;
  const inviteStatusLabel = getInviteStatusLabel(invite);
  const canAccept = canAcceptInvite(invite);

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Workspace invitation</CardTitle>
        <CardDescription>Review your invite details before joining this workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusMessage ? (
          <p
            className={
              isErrorMessage
                ? "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            }
          >
            {statusMessage}
          </p>
        ) : null}

        <dl className="space-y-1 text-sm text-slate-700">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium text-slate-500">Invited email</dt>
            <dd>{invite.invited_email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium text-slate-500">Role</dt>
            <dd className="uppercase tracking-wide">{invite.invited_role}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-medium text-slate-500">Status</dt>
            <dd>{inviteStatusLabel}</dd>
          </div>
        </dl>

        {canAccept ? (
          <form action={acceptInvite} className="space-y-3">
            <input name="token" type="hidden" value={token} />
            <SubmitButton className="w-full" pendingLabel="Accepting invite...">
              Accept invite
            </SubmitButton>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              This invite cannot be accepted anymore. Ask a workspace admin to resend a new invite.
            </p>
            <Link href={workspaceHref}>
              <Button className="w-full" type="button" variant="secondary">
                Open workspace dashboard
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
