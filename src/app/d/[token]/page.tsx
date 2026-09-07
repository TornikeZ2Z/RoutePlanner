import { notFound } from "next/navigation";
import { adminT, adminLocale } from "@/lib/i18n/admin";
import { formTokenMatches } from "@/lib/change-requests";
import { getRound, currentRoundSlug } from "@/lib/decisions";

export const dynamic = "force-dynamic";
/** Never indexed, never followed. The URL is the only thing protecting it. */
export const metadata = { robots: { index: false, follow: false } };

/**
 * The questions we need answered.
 *
 * Deliberately the same shape as the change-request form at /r/[token]: an
 * unguessable link, no login, a self-reported name. The people who have to
 * answer these are the same people who file the requests, and an account
 * requirement is exactly the friction that keeps them quiet.
 *
 * One native POST for the whole round. It was tempting to save each answer as
 * it was picked, but a form that saves silently gives the reader no moment
 * where they have decided — and this is a document about deciding.
 */
export default async function DecisionsPage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  if (!formTokenMatches(token)) notFound();

  const sp = await searchParams;
  const locale = adminLocale(String(sp.lang ?? "ka"));
  const t = adminT(locale);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  // A link with no round opens whichever is still taking answers, so the URL
  // people are sent does not go stale between rounds.
  const slug = one(sp.round) ?? (await currentRoundSlug());
  if (!slug) notFound();
  const round = await getRound(slug);
  if (!round) notFound();

  const sent = one(sp.sent);
  const throttled = one(sp.error) === "throttled";
  const empty = one(sp.error) === "empty";
  const other = locale === "ka" ? "en" : "ka";
  const otherLabel = locale === "ka" ? "English" : "ქართული";
  const here = `/d/${token}?round=${round.slug}&lang=`;

  return (
    <div className="min-h-screen bg-ink-50/50">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <div className="mb-7 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl text-ink-900 sm:text-3xl">{round.title}</h1>
          <a href={`${here}${other}`} className="shrink-0 text-sm text-ink-500 hover:text-pine-800 hover:underline">
            {otherLabel}
          </a>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-ink-200 bg-white p-7 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-pine-50 text-pine-800">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
                <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="font-display text-xl text-ink-900">{t("dq.sentT")}</h2>
            <p className="mt-2 leading-relaxed text-ink-600">{t("dq.sentB", { n: sent })}</p>
            <a
              href={`${here}${locale}`}
              className="mt-6 inline-block rounded-lg bg-pine-800 px-4 py-2 text-sm font-medium text-white hover:bg-pine-900"
            >
              {t("dq.again")}
            </a>
          </div>
        ) : (
          <>
            {round.lede && <p className="mb-6 max-w-2xl leading-relaxed text-ink-600">{round.lede}</p>}

            {!round.accepting && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t("dq.closed")}
              </div>
            )}
            {throttled && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t("dq.throttled")}
              </div>
            )}
            {empty && (
              <div className="mb-5 rounded-xl border border-rust-200 bg-rust-50 px-4 py-3 text-sm text-rust-800">
                {t("dq.empty")}
              </div>
            )}

            {/* A native POST to a route handler, so the form submits even
                if the page's JavaScript never loads. */}
            <form action="/api/decisions" method="post" className="space-y-5">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="round" value={round.slug} />
              <input type="hidden" name="lang" value={locale} />
              <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-6">
                <label htmlFor="name" className="block text-sm font-medium text-ink-900">
                  {t("dq.nameL")}
                </label>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{t("dq.nameH")}</p>
                <input
                  id="name" name="name" required minLength={2} maxLength={120} autoComplete="name"
                  className="mt-2 w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-pine-800 focus:outline-none focus:ring-1 focus:ring-pine-800"
                />
              </div>

              {round.questions.map((q, i) => (
                <fieldset key={q.id} className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-6">
                  <legend className="sr-only">{q.title}</legend>

                  <div className="flex flex-wrap items-center gap-2">
                    {(q.ticket || q.item) && (
                      <span className="rounded bg-ink-100 px-2 py-0.5 font-mono text-[11px] text-ink-500">
                        {[q.ticket, q.item].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    <span className="rounded border border-gold-600 bg-gold-50 px-2 py-0.5 text-[11px] font-semibold text-gold-700">
                      {t("dq.nOf", { n: i + 1, total: round.questions.length })}
                    </span>
                  </div>
                  <h2 className="font-display mt-2 text-lg leading-snug text-ink-900">{q.title}</h2>

                  {q.ask && (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">{t("dq.asked")}</p>
                      <p className="mt-1 border-l-[3px] border-gold-600 pl-3 text-sm leading-relaxed text-ink-600">{q.ask}</p>
                    </div>
                  )}

                  {q.stands.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">{t("dq.stands")}</p>
                      <div className="mt-1 space-y-2 rounded-xl bg-ink-50 p-4">
                        {q.stands.map((s, k) => (
                          <p key={k} className="text-sm leading-relaxed text-ink-700">{s}</p>
                        ))}
                        {q.refs.length > 0 && (
                          <p className="flex flex-wrap gap-1.5 pt-1">
                            {q.refs.map((r) => (
                              <code key={r} className="rounded border border-ink-200 bg-white px-1.5 py-0.5 font-mono text-[11px] break-all text-ink-500">
                                {r}
                              </code>
                            ))}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">{t("dq.need")}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-900">{q.need}</p>
                  </div>

                  {q.options.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {q.options.map((o) => (
                        <label
                          key={o.v}
                          className="flex cursor-pointer gap-3 rounded-lg border border-ink-300 p-3 hover:border-ink-400 has-[:checked]:border-gold-600 has-[:checked]:bg-gold-50"
                        >
                          <input
                            type="radio" name={`c_${q.id}`} value={o.v}
                            className="mt-1 size-4 shrink-0 accent-gold-600"
                          />
                          <span>
                            <span className="block text-sm font-medium leading-snug text-ink-900">
                              {o.rec && (
                                <span className="mr-2 rounded border border-gold-600 px-1.5 py-px text-[10px] font-semibold uppercase text-gold-700">
                                  {t("dq.rec")}
                                </span>
                              )}
                              {o.label}
                            </span>
                            {o.why && <span className="mt-1 block text-xs leading-relaxed text-ink-500">{o.why}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    <label htmlFor={`n_${q.id}`} className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">
                      {t("dq.notesL")}
                    </label>
                    <textarea
                      id={`n_${q.id}`} name={`n_${q.id}`} rows={3} maxLength={4000}
                      placeholder={t("dq.notesH")}
                      className="mt-1.5 w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-pine-800 focus:outline-none focus:ring-1 focus:ring-pine-800"
                    />
                  </div>
                </fieldset>
              ))}

              <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-sm leading-relaxed text-ink-600">{t("dq.partial")}</p>
                <button
                  type="submit"
                  disabled={!round.accepting}
                  className="mt-4 w-full rounded-lg bg-pine-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-pine-900 focus:outline-none focus:ring-2 focus:ring-pine-800 focus:ring-offset-2 disabled:opacity-50"
                >
                  {t("dq.submit")}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
