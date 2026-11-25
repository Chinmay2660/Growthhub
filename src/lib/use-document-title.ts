"use client";

import { useEffect } from "react";

const DEFAULT_TITLE = "GrowthHub";

/** Sets `document.title` to "<title> · GrowthHub" while the page is mounted. Pass nothing while loading. */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} · ${DEFAULT_TITLE}`;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
