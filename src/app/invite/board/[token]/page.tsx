import Link from "next/link";
import type { Metadata } from "next";
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
import { getOptionalAuthContext } from "@/lib/auth/server";
import { hashInviteToken, isInviteExpired } from "@/lib/invites";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getFirstQueryParamValue, isPromise } from "@/shared";

import { acceptBoardInvite } from "./actions";

type BoardInvitePageParams = {
  token: string;
};

type BoardInvitePageSearchParams = {
  message?: string | string[];
  type?: string | string[];
};

type BoardInvitePageProps = {
  params: BoardInvitePageParams | Promise<BoardInvitePageParams>;
  searchParams?: BoardInvitePageSearchParams | Promise<BoardInvitePageSearchParams>;
};

type BoardInviteRecord = {
  accepted_at: string | null;
  board_id: string;
  expires_at: string;
  id: string;
  invited_email: string;
  invited_role: "viewer" | "member" | "admin";
  status: "pending" | "accepted" | "revoked" | "expired";
};

export const metadata: Metadata = {
  title: "Board Invitation | NextS",
  description: "Review and accept your NextS board invitation.",
};

async function resolveParams(
  params: BoardInvitePageProps["params"],
): Promise<BoardInvitePageParams> {
  if (isPromise(params)) {
    return await params;
  }

  return params;
}

async function resolveSearchParams(
  searchParams: BoardInvitePageProps["searchParams"],
): Promise<BoardInvitePageSearchParams> {
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
    next: APP_ROUTES.inviteBoardByToken(token),
  });
  return `${APP_ROUTES.login}?${searchParams.toString()}`;
}

function getInviteStatusLabel(invite: BoardInviteRecord): string {
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

function canAcceptInvite(invite: BoardInviteRecord): boolean {
  return invite.status === "pending" && !isInviteExpired(invite.expires_at);
}

export default async function BoardInvitePage({ params, searchParams }: BoardInvitePageProps) {
  const { token } = await resolveParams(params);
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const statusMessage = getFirstQueryParamValue(resolvedSearchParams.message);
  const statusType = getFirstQueryParamValue(resolvedSearchParams.type);
  const isErrorMessage = statusType !== "success";

  const supabase = await createServerSupabaseClient();
  const authContext = await getOptionalAuthContext();
  if (!authContext) {
    redirect(withLoginRedirect(token));
  }

  const tokenHash = hashInviteToken(token);
  const { data } = await supabase
    .from("board_invites")
    .select("id, board_id, invited_email, invited_role, status, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  const invite = (data ?? null) as BoardInviteRecord | null;

  if (!invite) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Board invite unavailable</CardTitle>
          <CardDescription>
            This board invite link is invalid, expired, revoked, or does not belong to your current account.
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

  const inviteStatusLabel = getInviteStatusLabel(invite);
  const canAccept = canAcceptInvite(invite);

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Board invitation</CardTitle>
        <CardDescription>Review your board invite details before joining this board.</CardDescription>
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
            <dt className="font-medium text-slate-500">Board ID</dt>
            <dd>{invite.board_id}</dd>
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
          <form action={acceptBoardInvite} className="space-y-3">
            <input name="token" type="hidden" value={token} />
            <SubmitButton className="w-full" pendingLabel="Accepting invite...">
              Accept board invite
            </SubmitButton>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              This invite cannot be accepted anymore. Ask a board admin to resend a new invite.
            </p>
            <Link href={APP_ROUTES.workspace.index}>
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
