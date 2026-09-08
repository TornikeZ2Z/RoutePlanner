/**
 * Drain the notification outbox. The scheduled worker that
 * src/lib/notifications.ts has always assumed exists.
 *
 *   docker compose --profile ops run --rm tools npx tsx deploy/scripts/dispatch-notifications.ts [limit]
 *
 * Runs in the tools image every five minutes (deploy/host/routeplanner-
 * dispatch.timer). Safe to overlap with the app's own opportunistic
 * dispatch: rows are claimed FOR UPDATE SKIP LOCKED, so nothing is sent twice.
 *
 * Needs NODE_OPTIONS=--conditions=react-server (set in the image) so the
 * `server-only` marker resolves to its empty module instead of throwing.
 */
import { dispatchPending } from "@/lib/notifications";
import { sql } from "@db/client";

const limit = Number(process.argv[2] ?? 50);
if (!Number.isInteger(limit) || limit <= 0) {
  console.error("usage: dispatch-notifications.ts [limit>0]");
  process.exit(2);
}

try {
  const { sent, failed } = await dispatchPending(limit);
  const [pending] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM notifications
    WHERE state IN ('QUEUED','FAILED') AND attempts < 5`;
  console.log(`dispatch: sent=${sent} failed=${failed} still_pending=${pending?.n ?? "?"}`);
  // A batch with failures is worth a non-zero exit so the timer shows it,
  // but only when nothing at all went out: partial delivery is progress.
  process.exitCode = failed > 0 && sent === 0 ? 1 : 0;
} finally {
  await sql.end({ timeout: 5 });
}
