import { NextResponse, type NextRequest } from "next/server";
import { formTokenMatches } from "@/lib/change-requests";
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

  const token = str("token");
  const slug = str("round");
  const lang = str("lang") === "en" ? "en" : "ka";
  const back = (q: string) => NextResponse.redirect(
    new URL(`/d/${token}?round=${slug}&lang=${lang}&${q}`, req.url), 303,
  );

  // A wrong token is a 404, not a 403: confirming the path exists is most of
  // the work of finding it.
  if (!formTokenMatches(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

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
