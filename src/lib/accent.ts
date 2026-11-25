/**
 * Accent colour presets. The colours themselves live in globals.css (generated, each one checked for readable
 * contrast in light and dark); this list drives the picker. "like" names the kind of app that uses a similar accent.
 */
export type AccentPreset = { id: string; label: string; like: string; swatch: string };

export const ACCENTS: AccentPreset[] = [
  {
    "id": "ember",
    "label": "Ember",
    "like": "GrowthHub",
    "swatch": "#A84D1F"
  },
  {
    "id": "indigo",
    "label": "Indigo",
    "like": "Linear",
    "swatch": "#5e6ad2"
  },
  {
    "id": "tomato",
    "label": "Tomato",
    "like": "Todoist",
    "swatch": "#d13f2e"
  },
  {
    "id": "forest",
    "label": "Forest",
    "like": "Forest, Evernote",
    "swatch": "#268157"
  },
  {
    "id": "ocean",
    "label": "Ocean",
    "like": "Google Calendar, Trello",
    "swatch": "#196edf"
  },
  {
    "id": "violet",
    "label": "Violet",
    "like": "Habitica",
    "swatch": "#6d3fc0"
  },
  {
    "id": "amber",
    "label": "Amber",
    "like": "LeetCode",
    "swatch": "#a3670e"
  },
  {
    "id": "teal",
    "label": "Teal",
    "like": "Notion-style teal",
    "swatch": "#10806d"
  },
  {
    "id": "rose",
    "label": "Rose",
    "like": "Rose and pink accents",
    "swatch": "#c63d6d"
  }
];

export const DEFAULT_ACCENT = "ember";
export const ACCENT_STORAGE_KEY = "growthhub-accent";

export function isAccentId(value: unknown): value is string {
  return typeof value === "string" && ACCENTS.some((a) => a.id === value);
}

export function getStoredAccent(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentId(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

/** Applies the accent to the page straight away and remembers it on this device. */
export function applyAccent(id: string) {
  const accent = isAccentId(id) ? id : DEFAULT_ACCENT;
  document.documentElement.dataset.accent = accent;
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    /* storage blocked: the colour still applies for this visit */
  }
}
