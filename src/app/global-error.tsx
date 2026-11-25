"use client";

import { useEffect } from "react";

/** Last-resort boundary: replaces the root layout, so it renders its own <html> and <body>. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong · GrowthHub</title>
        <style>{`
          :root { --bg:#f8f6f2; --fg:#1c1917; --muted:#6b645f; --brand:#a84d1f; --brand-hover:#8f4118; }
          @media (prefers-color-scheme: dark) { :root { --bg:#12100e; --fg:#f5f0ea; --muted:#a8a29e; } }
          body { margin:0; background:var(--bg); color:var(--fg); font-family:ui-sans-serif,system-ui,sans-serif; }
          .ge { min-height:100dvh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 1rem; text-align:center; }
          .ge h1 { margin:0; font-size:1.5rem; font-weight:700; }
          .ge p { margin:.5rem 0 0; max-width:24rem; font-size:.875rem; color:var(--muted); }
          .ge button { margin-top:1.5rem; border:0; border-radius:.5rem; background:var(--brand); color:#fff; padding:.5rem 1rem; font-size:.875rem; font-weight:500; cursor:pointer; }
          .ge button:hover { background:var(--brand-hover); }
          .ge button:focus-visible { outline:2px solid var(--brand); outline-offset:2px; }
        `}</style>
      </head>
      <body>
        <main className="ge">
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Please try again.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
