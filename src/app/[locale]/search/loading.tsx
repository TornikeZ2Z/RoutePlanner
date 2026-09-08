/**
 * A skeleton for the results page only — deliberately not at the app root.
 *
 * It used to live at src/app/loading.tsx, which put a Suspense boundary around
 * every route in the application. That is what made streaming start on every
 * request, and once a response has started streaming its status line is
 * already sent: every notFound() in the app then rendered the 404 page under a
 * 200. Measured before this change, /ka/destinations/nowhere, /ka/tours/nope,
 * /ka/transfers/nope, /ka/drivers/nope, /ka/legal/nope, /d/no-such-round and
 * even /xx all answered 200 while showing "Page not found". A soft 404 is the
 * worst of both: search engines index the missing page as real, and monitoring
 * cannot tell a broken link from a working one.
 *
 * Here it wraps one segment. The results page is the only place with a wait
 * worth showing — it prices every driver against the route before it can
 * render — and the notFound() above it, in the locale layout, is reached
 * before this boundary exists, so a bad locale still answers 404.
 *
 * Do not move this back up the tree. If another slow page wants a skeleton, it
 * gets its own file in its own segment.
 */
export default function Loading() {
  return (
    <div className="py-12" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="space-y-3">
        <div className="h-6 w-48 animate-pulse rounded bg-ink-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
      </div>
    </div>
  );
}
