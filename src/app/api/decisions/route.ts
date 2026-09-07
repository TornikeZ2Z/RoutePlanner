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

  // Checked here rather than by the browser, so the answer is a page with a
  // message on it instead of a button that appears to do nothing.
  if (str("name").trim().length < 2) return back("error=name");

  const given = round.questions.map((q) => ({
    questionId: q.id,
    choice: str(`c_${q.id}`) || undefined,
    notes: str(`n_${q.id}`) || undefined,
  }));

  const who = str("name").trim();
  const n = await recordAnswers(slug, who, given);
  if (n === 0) return back("error=empty");

  /*
   * Remember who this is, so returning to the form shows them what they
   * already sent rather than a blank page. Identity here is a self-reported
   * name and nothing is gated on it — this cookie only decides whose draft to
   * show back on this device.
   */
  const res = back(`sent=${n}`);
  res.cookies.set("decisions_who", who, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
