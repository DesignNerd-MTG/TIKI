export const themePresets = [
  {
    id: "volcanic-sand",
    label: "Volcanic sand",
    description: "Warm stone, weathered teak, and deep lagoon accents.",
    swatches: ["#c8baa8", "#e5d9c8", "#087f83", "#211b17"],
  },
  {
    id: "lagoon",
    label: "Lagoon",
    description: "Cool sea glass with a grounded, low-glare canvas.",
    swatches: ["#abc9c4", "#d5e6e1", "#087579", "#102626"],
  },
  {
    id: "sunset-coral",
    label: "Sunset coral",
    description: "Burnished coral, clay, and late-day warmth.",
    swatches: ["#d4aa93", "#edd2c1", "#9e4938", "#321d18"],
  },
  {
    id: "palm",
    label: "Palm",
    description: "Muted canopy greens with natural paper surfaces.",
    swatches: ["#afbf9f", "#d5dfc8", "#42673f", "#1e2b1d"],
  },
  {
    id: "night",
    label: "Night watch",
    description: "A dark, calm production-booth palette for late calls.",
    swatches: ["#15272d", "#294249", "#6bc5bd", "#f2eee5"],
  },
] as const;

export type ThemePreset = (typeof themePresets)[number]["id"];

export const defaultTheme: ThemePreset = "volcanic-sand";

export function isThemePreset(value: unknown): value is ThemePreset {
  return typeof value === "string" && themePresets.some((preset) => preset.id === value);
}

export function resolveTheme(value: unknown): ThemePreset {
  return isThemePreset(value) ? value : defaultTheme;
}
