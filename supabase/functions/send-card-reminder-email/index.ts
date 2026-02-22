import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "@supabase/supabase-js";

type ReminderOutboxRow = {
  attempts: number;
  board_id: string;
  card_id: string;
  channel: "email";
  created_at: string;
  id: string;
  last_error: string | null;
  recipient_user_id: string;
  scheduled_for: string;
  sent_at: string | null;
  status: "processing";
  updated_at: string;
  workspace_id: string;
};

type CardLookup = {
  due_at: string | null;
  id: string;
  title: string;
};

type EdgeRuntimeLike = {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function responseJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
    status,
  });
}

function buildEmailHtml(params: { cardTitle: string; dueAt: string | null }): string {
  const dueLabel = params.dueAt
    ? new Date(params.dueAt).toLocaleString(undefined, {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "Không có hạn";

  return `
  <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a;">
    <h2 style="margin-bottom: 8px;">NexaBoard Reminder</h2>
    <p style="margin: 0 0 12px 0;">Thẻ <strong>${params.cardTitle}</strong> cần bạn chú ý.</p>
    <p style="margin: 0;">Hạn: <strong>${dueLabel}</strong></p>
  </div>
  `;
}

function resolveEdgeRuntime(): EdgeRuntimeLike | null {
  const runtime = (globalThis as { Deno?: EdgeRuntimeLike }).Deno;
  if (!runtime || typeof runtime.serve !== "function" || typeof runtime.env?.get !== "function") {
    return null;
  }

  return runtime;
}

function isReminderOutboxRow(value: unknown): value is ReminderOutboxRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Partial<ReminderOutboxRow>;
  return (
    typeof row.id === "string"
    && typeof row.card_id === "string"
    && typeof row.recipient_user_id === "string"
  );
}

function isReminderOutboxRows(value: unknown): value is ReminderOutboxRow[] {
  return Array.isArray(value) && value.every(isReminderOutboxRow);
}

const edgeRuntime = resolveEdgeRuntime();
if (!edgeRuntime) {
  throw new Error("Supabase Edge runtime is unavailable. Expected Deno globals.");
}

edgeRuntime.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return responseJson({ ok: true });
  }

  if (req.method !== "POST") {
    return responseJson({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = edgeRuntime.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = edgeRuntime.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = edgeRuntime.env.get("RESEND_API_KEY") ?? "";
  const senderEmail = edgeRuntime.env.get("REMINDER_SENDER_EMAIL") ?? "noreply@nexaboard.dev";

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return responseJson({ error: "Missing runtime secrets for reminder sender." }, 500);
  }

  let requestedBatchSize = 50;
  try {
    const body = (await req.json().catch(() => ({}))) as { batchSize?: number };
    if (typeof body.batchSize === "number" && Number.isFinite(body.batchSize)) {
      requestedBatchSize = Math.max(1, Math.min(200, Math.floor(body.batchSize)));
    }
  } catch {
    requestedBatchSize = 50;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: claimedRows, error: claimError } = await supabase
    .rpc("claim_email_card_reminders", { max_rows: requestedBatchSize })
    .returns<ReminderOutboxRow[]>();

  if (claimError) {
    return responseJson({ error: claimError.message }, 500);
  }

  const claimedPayload = claimedRows ?? [];
  if (!isReminderOutboxRows(claimedPayload)) {
    return responseJson({ error: "Unexpected claim_email_card_reminders payload shape." }, 500);
  }

  const rows: ReminderOutboxRow[] = claimedPayload;
  if (rows.length < 1) {
    return responseJson({ failed: 0, sent: 0, total: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, title, due_at")
      .eq("id", row.card_id)
      .maybeSingle<CardLookup>();

    if (cardError || !card) {
      failed += 1;
      await supabase.rpc("mark_card_reminder_email_failed", {
        error_message: cardError?.message ?? "Card not found for reminder email.",
        should_retry: false,
        target_outbox_id: row.id,
      });
      continue;
    }

    const { data: userLookup, error: userError } = await supabase.auth.admin.getUserById(row.recipient_user_id);
    const recipientEmail = userLookup?.user?.email?.trim();
    if (userError || !recipientEmail) {
      failed += 1;
      await supabase.rpc("mark_card_reminder_email_failed", {
        error_message: userError?.message ?? "Recipient email is missing.",
        should_retry: false,
        target_outbox_id: row.id,
      });
      continue;
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      body: JSON.stringify({
        from: senderEmail,
        html: buildEmailHtml({
          cardTitle: card.title,
          dueAt: card.due_at,
        }),
        subject: `NexaBoard reminder: ${card.title}`,
        to: [recipientEmail],
      }),
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!resendResponse.ok) {
      const resendText = await resendResponse.text();
      failed += 1;
      await supabase.rpc("mark_card_reminder_email_failed", {
        error_message: `Resend error: ${resendText}`,
        should_retry: true,
        target_outbox_id: row.id,
      });
      continue;
    }

    sent += 1;
    await supabase.rpc("mark_card_reminder_email_sent", {
      target_outbox_id: row.id,
    });
  }

  return responseJson({ failed, sent, total: rows.length });
});
