import { requirePermission } from "@/lib/auth/session";
import { sql } from "@db/client";
import { config } from "@/lib/config";
import { getTransport, normalizeSender } from "@/lib/notifications";
import { Alert, Badge, Card, EmptyState, PageHeader, Table } from "@/components/ui";
import { SendSmsForm } from "./forms";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  kind: string;
  channel: string;
  to_address: string;
  state: string;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  sent_at: Date | null;
}

const STATE_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  SENT: "success",
  QUEUED: "warning",
  SENDING: "warning",
  FAILED: "danger",
};

/**
 * Where a message actually goes, and proof that it went.
 *
 * Two questions this page exists to answer, both of which were previously only
 * answerable by reading Render's environment tab:
 *
 *   1. Is the SMS gateway configured, and under exactly which sender name?
 *      The name matters more than it looks — smsoffice.ge caps it at eleven
 *      characters and refuses, with error 150, any name not registered on the
 *      account. It refuses silently in the sense that matters: the reply names
 *      no alternative. So the value we will actually transmit is printed here,
 *      next to the value that was configured, because a difference between
 *      those two is the whole bug.
 *
 *   2. Did the last thing we sent arrive? The outbox already recorded that;
 *      nothing in the console showed it outside a single booking.
 *
 * Owner-level, on the same permission as staff and roles: this page can send
 * text from the company's registered sender to any Georgian number.
 */
export default async function NotificationsConsole() {
  await requirePermission("admin.rbac.write");

  const rows = await sql<Row[]>`
    SELECT id, kind, channel::text AS channel, to_address, state::text AS state,
           attempts, last_error, created_at, sent_at
    FROM notifications
    ORDER BY created_at DESC
    LIMIT 25`;

  const smsKeySet = Boolean(config.sms.apiKey);
  const senderRaw = config.sms.sender;
  const senderSent = normalizeSender(senderRaw);
  const smsReady = smsKeySet && senderSent.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="What the server can send, what it sent, and a way to send one by hand."
      />

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink-900">Transport</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 border-b border-ink-100 pb-2">
            <dt className="text-ink-500">Active transport</dt>
            <dd className="font-medium text-ink-900">{getTransport().name}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-ink-100 pb-2">
            <dt className="text-ink-500">SMS gateway key</dt>
            <dd>
              <Badge tone={smsKeySet ? "success" : "danger"}>{smsKeySet ? "set" : "missing"}</Badge>
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-ink-100 pb-2">
            <dt className="text-ink-500">Sender configured</dt>
            <dd className="font-medium text-ink-900">{senderRaw || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-ink-100 pb-2">
            <dt className="text-ink-500">Sender transmitted</dt>
            <dd className="font-medium text-ink-900">{senderSent || "—"}</dd>
          </div>
        </dl>

        {/*
          The one failure this page is here to catch, and it has already
          happened once: the account is registered as "Route Plan", the code
          transmitted "RoutePlan", and smsoffice answered 150 every time.
          Saying so here is cheaper than reading it off a rejection.
        */}
        {senderRaw !== senderSent && (
          <Alert tone="warning" title="The sender name is rewritten before sending">
            {`Configured as "${senderRaw}", transmitted as "${senderSent}". Eleven characters is the
            cap, and characters that would corrupt the request are removed. Whatever survives has to
            match the name registered with smsoffice exactly, or every send is refused with code
            150 — which is what happened when the space in "Route Plan" was being stripped.`}
          </Alert>
        )}
        {!smsReady && (
          <Alert tone="danger" title="SMS will not leave this server">
            Set SMSOFFICE_API_KEY and SMSOFFICE_SENDER in the deployment environment. Until both
            are present, anything queued as SMS is written to the log instead.
          </Alert>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink-900">Send a message</h2>
        <p className="mt-1 mb-4 text-sm text-ink-500">
          Goes through the outbox like everything else, so it appears in the table below with
          whatever the gateway answered.
        </p>
        <SendSmsForm defaultSender={senderRaw} />
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Outbox</h2>
        {rows.length === 0 ? (
          <EmptyState title="Nothing has been queued yet." />
        ) : (
          <Table head={["When", "Kind", "Channel", "To", "State", "Tries", "Error"]}>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-ink-100 align-top">
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-500">
                  {new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-4 py-2.5">{r.kind}</td>
                <td className="px-4 py-2.5">{r.channel.toLowerCase()}</td>
                <td className="px-4 py-2.5">{r.to_address}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={STATE_TONE[r.state] ?? "neutral"}>{r.state.toLowerCase()}</Badge>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{r.attempts}</td>
                <td className="px-4 py-2.5 text-ink-600">{r.last_error ?? ""}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
