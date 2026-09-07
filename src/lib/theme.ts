export const themePresets = [
  {
    id: "volcanic-sand",
    label: "Volcanic sand",
    description: "Dark lava rock, weathered teak, and hot coral accents.",
    swatches: ["#1f1b18", "#352e29", "#c9684f", "#1b1816"],
    text: "#f2e8da",
  },
  {
    id: "lagoon",
    label: "Lagoon",
    description: "Deep-water teal with cool sea-glass highlights.",
    swatches: ["#173034", "#2b4d4f", "#58bdb5", "#142a2d"],
    text: "#e5f3ef",
  },
  {
    id: "sunset-coral",
    label: "Sunset coral",
    description: "Smoked clay, burnished coral, and late-day warmth.",
    swatches: ["#3b2521", "#643d32", "#d96b50", "#321e1a"],
    text: "#f6e2d5",
  },
  {
    id: "palm",
    label: "Palm",
    description: "Shadowed canopy greens with fresh leaf highlights.",
    swatches: ["#223023", "#405744", "#7faf72", "#1d2a1e"],
    text: "#e7f0df",
  },
  {
    id: "night",
    label: "Night watch",
    description: "A dark, calm production-booth palette for late calls.",
    swatches: ["#15272d", "#294249", "#6bc5bd", "#101f24"],
    text: "#f2eee5",
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
