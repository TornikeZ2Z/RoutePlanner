"use client";

import { useEffect } from "react";

/**
 * Crossfading hero carousel — zero-dependency by design.
 *
 * This deliberately does NOT use React state. The live site showed sessions
 * where streamed pages never hydrated (environment-dependent; the app itself
 * hydrates cleanly), and a hero that only moves when React wakes up is a
 * hero that sometimes doesn't move. A short inline script owns the rotation
 * instead: it runs the moment the HTML arrives, needs nothing downloaded, and
 * works identically with hydration, without it, and with JavaScript
 * half-broken. Reduced-motion users get instant swaps, not fades.
 *
 * That covers a cold load. It does not cover a soft navigation: a browser
 * never executes a <script> React inserts into the DOM, so arriving at the
 * homepage from another page left the hero frozen on slide one with dead
 * dots. React says so in development — "scripts inside React components are
 * never executed when rendering on the client" — and it is right.
 *
 * The two paths are complementary, so both are kept. The inline script covers
 * the case React cannot (no hydration); the effect below covers the case the
 * inline script cannot (soft navigation), and a soft navigation by definition
 * means React is alive to run it. One implementation serves both: the effect
 * re-executes the same source through a real script element, which the
 * browser does run, rather than duplicating the logic in TypeScript.
 */
const SCRIPT = `(function(){
var roots=[].slice.call(document.querySelectorAll("[data-carousel]"));
roots.forEach(function(root){
  if(root.getAttribute("data-carousel")==="live")return;
  root.setAttribute("data-carousel","live");
  var slides=[].slice.call(root.querySelectorAll("[data-slide]"));
  var dots=[].slice.call(root.querySelectorAll("[data-dot]"));
  if(slides.length<2)return;
  var i=0,t;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)
    slides.forEach(function(s){s.classList.remove("transition-opacity","duration-1000")});
  function show(n){i=n;
    slides.forEach(function(s,j){s.classList.toggle("opacity-100",j===n);s.classList.toggle("opacity-0",j!==n)});
    dots.forEach(function(d,j){d.classList.toggle("bg-white",j===n);d.classList.toggle("bg-white/40",j!==n)});}
  function tick(){show((i+1)%slides.length)}
  t=setInterval(tick,6000);
  dots.forEach(function(d,j){d.addEventListener("click",function(){clearInterval(t);show(j);t=setInterval(tick,6000)})});
});
})();`;

export function HeroCarousel({ images }: { images: string[] }) {
  useEffect(() => {
    /*
     * On a cold load the inline script has already run and marked the root
     * live, so this finds nothing to do and costs one querySelectorAll. On a
     * soft navigation the script was inserted but never executed, and this is
     * what actually starts the rotation.
     *
     * A real element appended to the document executes; the same source set
     * through innerHTML would not, which is the whole reason this exists.
     */
    const el = document.createElement("script");
    el.textContent = SCRIPT;
    document.body.appendChild(el);
    el.remove();
  }, []);

  if (images.length === 0) return null;
  return (
    <>
      <div className="absolute inset-0" data-carousel="">
        {/*
          WebP first, the JPEG as the fallback the browser only fetches if it
          cannot do WebP.

          These are the heaviest thing on the site: eight 2400x1500 JPEGs at
          3.2 MB total, and because every slide is in the viewport from the
          start — merely transparent — `loading="lazy"` defers almost nothing.
          A first visit on a Georgian phone paid for all of them. The same
          pictures at 1800px wide in WebP are 1.36 MB, and the six the carousel
          actually uses come to about 1.1 MB.

          <picture> rather than next/image on purpose: the whole point of this
          component is that it works before React does, and next/image needs
          the runtime. The <img> keeps data-slide, so the inline script that
          rotates the slides still selects exactly what it selected before, and
          it stays the element that carries the opacity classes.
        */}
        {images.map((src, i) => (
          <picture key={src}>
            <source srcSet={src.replace(/\.jpg$/, ".webp")} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-slide={i}
              src={src}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ${
                i === 0 ? "opacity-100" : "opacity-0"
              }`}
            />
          </picture>
        ))}
        {images.length > 1 && (
          <div className="absolute bottom-5 right-5 z-10 flex gap-2">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                data-dot={i}
                tabIndex={-1}
                aria-label={`${i + 1} / ${images.length}`}
                className={`size-2.5 rounded-full transition-colors hover:bg-white/70 ${
                  i === 0 ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
