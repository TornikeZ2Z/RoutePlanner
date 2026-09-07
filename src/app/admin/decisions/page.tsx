import { requirePermission } from "@/lib/auth/session";
import { adminT, adminLocale } from "@/lib/i18n/admin";
import { Badge, Card, PageHeader, Alert } from "@/components/ui";
import { listRounds, getRound, listAnswers } from "@/lib/decisions";
import { formEnabled } from "@/lib/change-requests";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/**
 * What came back.
 *
 * Every answer is shown, not the latest one per question: two people
 * answering the same question differently is the single most useful thing
 * this form can surface, and collapsing it to a winner would throw away
 * exactly the disagreement somebody needs to resolve.
 */
export default async function DecisionsConsole({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission("admin.requests.read");
  const sp = await searchParams;
  const t = adminT(adminLocale(actor.locale ?? "ka"));
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const rounds = await listRounds();
  const slug = one(sp.round) ?? rounds[0]?.slug;
  const round = slug ? await getRound(slug) : null;
  const answers = slug ? await listAnswers(slug) : [];

  const byQuestion = new Map<string, typeof answers>();
  for (const a of answers) {
    const list = byQuestion.get(a.questionId) ?? [];
    list.push(a);
    byQuestion.set(a.questionId, list);
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <PageHeader title={t("dq.consoleT")} description={t("dq.consoleLead")} />

      {rounds.length === 0 && <Alert tone="neutral">{t("dq.noRounds")}</Alert>}

      {rounds.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {rounds.map((r) => (
            <a
              key={r.slug}
              href={`/admin/decisions?round=${r.slug}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                r.slug === slug ? "border-ink-900 bg-ink-900 text-white" : "border-ink-300 text-ink-700 hover:border-ink-500"
              }`}
            >
              {r.title}
            </a>
          ))}
        </div>
      )}

      {round && (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg text-ink-900">{round.title}</p>
                <p className="mt-1 text-sm text-ink-500">
                  {t("dq.progress", {
                    answered: byQuestion.size,
                    questions: round.questions.length,
                  })}
                </p>
              </div>
              {!round.accepting && <Badge tone="neutral">{t("dq.roundClosed")}</Badge>}
            </div>
            {/* The link to send. Shown only when a token is configured, since
                without one the form is a 404 and the link would be a lie. */}
            {formEnabled() && (
              <p className="mt-4 border-t border-ink-100 pt-4 text-sm text-ink-500">
                {t("dq.openLink")}:{" "}
                <code className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-xs break-all text-ink-700">
                  {config.appUrl}/d/{config.changeRequestToken}?round={round.slug}
                </code>
              </p>
            )}
          </Card>

          <div className="space-y-4">
            {round.questions.map((q, i) => {
              const given = byQuestion.get(q.id) ?? [];
              const label = (v: string | null) =>
                q.options.find((o) => o.v === v)?.label ?? v ?? "—";
              return (
                <Card key={q.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-ink-100 px-2 py-0.5 font-mono text-[11px] text-ink-500">
                      {i + 1}. {[q.ticket, q.item].filter(Boolean).join(" · ")}
                    </span>
                    {given.length > 0 && <Badge tone="success">{given.length}</Badge>}
                  </div>
                  <p className="font-display mt-2 text-base text-ink-900">{q.title}</p>

                  {given.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-400">{t("dq.noAnswers")}</p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {given.map((a) => (
                        <li key={a.id} className="rounded-xl border border-ink-200 bg-ink-50/60 p-3">
                          <p className="flex flex-wrap items-baseline gap-2 text-xs text-ink-500">
                            <span className="font-semibold text-ink-800">{a.answeredBy || "—"}</span>
                            <span>{fmt(a.createdAt)}</span>
                          </p>
                          {a.choice && (
                            <p className="mt-1.5 text-sm text-ink-900">
                              <span className="text-ink-400">{t("dq.chose")}: </span>
                              {label(a.choice)}
                            </p>
                          )}
                          {a.notes && (
                            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                              {a.notes}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
