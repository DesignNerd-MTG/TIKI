export const themePresets = [
  {
    id: "volcanic-sand",
    label: "Volcanic lounge",
    description: "Dark teak, burnt orange, and poolside turquoise.",
    swatches: ["#2b211b", "#5a4030", "#f06b3d", "#43b8c4"],
    control: "#211915",
    text: "#fff1d6",
  },
  {
    id: "lagoon",
    label: "Moonlit lagoon",
    description: "Powder-blue motel tones, turquoise, and sharp chartreuse.",
    swatches: ["#1e2a3b", "#3d5870", "#45b9d1", "#aac744"],
    control: "#182333",
    text: "#f5f4e8",
  },
  {
    id: "sunset-coral",
    label: "Sunset rum",
    description: "Palm Springs orange, mustard, coral, and tobacco brown.",
    swatches: ["#3a1d18", "#743625", "#f04b2e", "#e9b52e"],
    control: "#2d1714",
    text: "#fff0d2",
  },
  {
    id: "palm",
    label: "Palm canopy",
    description: "Avocado, olive, aqua, and a flash of tropical orange.",
    swatches: ["#1c2b17", "#46602b", "#94bd3e", "#59b7c5"],
    control: "#162211",
    text: "#f5efcf",
  },
  {
    id: "night",
    label: "Night orchid",
    description: "A plum cocktail lounge with lavender, aqua, and acid green.",
    swatches: ["#21172e", "#48305e", "#68c7d4", "#afc93d"],
    control: "#191121",
    text: "#ffffff",
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
