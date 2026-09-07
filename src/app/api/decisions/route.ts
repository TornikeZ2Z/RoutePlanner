import { NextResponse, type NextRequest } from "next/server";
import { getRound, recordAnswers } from "@/lib/decisions";
import { rateLimit, clientKey } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where the decision form posts.
 *
 * A route handler rather than a server action, for the same reason the
 * change-request form uses one: a native POST submits whether or not the
 * page's JavaScript ever loaded. A server action form is inert until React
 * has hydrated, and when hydration is slow or broken the button does nothing
 * at all — no error, no submission, nothing for the person to report.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const str = (k: string) => String(form.get(k) ?? "");

  const slug = str("round");
  const lang = str("lang") === "en" ? "en" : "ka";
  const back = (q: string) => NextResponse.redirect(
    new URL(`/d/${slug}?lang=${lang}&${q}`, req.url), 303,
  );

  /*
   * No token while the round is being built: the slug is the whole address.
   * The rate limit is therefore doing real work rather than belt-and-braces —
   * it is the only thing between this and somebody filling the table.
   */
  const limit = rateLimit(await clientKey("decisions"), 12, 60);
  if (!limit.allowed) return back("error=throttled");

  const round = await getRound(slug);
  if (!round) return new NextResponse("Not found", { status: 404 });

  const given = round.questions.map((q) => ({
    questionId: q.id,
    choice: str(`c_${q.id}`) || undefined,
    notes: str(`n_${q.id}`) || undefined,
  }));

  const n = await recordAnswers(slug, str("name"), given);
  return n === 0 ? back("error=empty") : back(`sent=${n}`);
}
