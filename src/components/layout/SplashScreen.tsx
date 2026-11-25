"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/components/providers/UserProvider";

const MIN_VISIBLE_MS = 700; // long enough to read as a splash, not a flicker
const MAX_VISIBLE_MS = 5000; // never trap someone behind it on a slow connection

/**
 * Branded splash, rendered from the first paint of the client app until the signed-in user is known.
 * Then it fades out and is removed.
 */
export default function SplashScreen() {
  const { loading } = useUser();
  const [minElapsed, setMinElapsed] = useState(false);
  const [maxElapsed, setMaxElapsed] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    const b = setTimeout(() => setMaxElapsed(true), MAX_VISIBLE_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const hiding = (!loading && minElapsed) || maxElapsed;

  useEffect(() => {
    if (!hiding) return;
    const t = setTimeout(() => setGone(true), 350); // matches the fade in globals.css
    return () => clearTimeout(t);
  }, [hiding]);

  if (gone) return null;

  return (
    <div className="splash" data-hiding={hiding || undefined} role="status" aria-label="Loading GrowthHub">
      <div className="splash-logo" aria-hidden>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <p className="splash-name">GrowthHub</p>
      <p className="splash-tag">Prepare. Practise. Grow.</p>
      <div className="splash-bar" aria-hidden>
        <span />
      </div>
    </div>
  );
}
