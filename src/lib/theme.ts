export const themePresets = [
  {
    id: "volcanic-sand",
    label: "Volcanic lounge",
    description: "Dark teak, burnt orange, and poolside turquoise.",
    swatches: ["#2b211b", "#5a4030", "#f06b3d", "#43b8c4"],
    control: "#211915",
    sidebar: "#18120f",
    sidebarText: "#fff1d6",
    text: "#fff1d6",
  },
  {
    id: "lagoon",
    label: "Moonlit lagoon",
    description: "Powder-blue motel tones, turquoise, and sharp chartreuse.",
    swatches: ["#1e2a3b", "#3d5870", "#45b9d1", "#aac744"],
    control: "#182333",
    sidebar: "#152235",
    sidebarText: "#f5f4e8",
    text: "#f5f4e8",
  },
  {
    id: "sunset-coral",
    label: "Sunset rum",
    description: "Palm Springs orange, mustard, coral, and tobacco brown.",
    swatches: ["#3a1d18", "#743625", "#f04b2e", "#e9b52e"],
    control: "#2d1714",
    sidebar: "#2a1513",
    sidebarText: "#fff0d2",
    text: "#fff0d2",
  },
  {
    id: "palm",
    label: "Palm canopy",
    description: "Avocado, olive, aqua, and a flash of tropical orange.",
    swatches: ["#1c2b17", "#46602b", "#94bd3e", "#59b7c5"],
    control: "#162211",
    sidebar: "#142313",
    sidebarText: "#f5efcf",
    text: "#f5efcf",
  },
  {
    id: "night",
    label: "Night orchid",
    description: "A plum cocktail lounge with lavender, aqua, and acid green.",
    swatches: ["#21172e", "#48305e", "#68c7d4", "#afc93d"],
    control: "#191121",
    sidebar: "#171021",
    sidebarText: "#ffffff",
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

export const customPaletteDefaults = {
  canvas: "#2b211b", surface: "#5a4030", primary_accent: "#43b8c4",
  secondary_accent: "#f06b3d", primary_text: "#fff1d6", muted_text: "#c9ad8b",
} as const;
export type CustomPaletteTokens = Record<keyof typeof customPaletteDefaults, string>;
export type CustomPalette = { slot: number; name: string; tokens: CustomPaletteTokens };
export function validPaletteTokens(value: unknown): value is CustomPaletteTokens {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Object.keys(customPaletteDefaults).every((key) => /^#[0-9a-f]{6}$/i.test(String(record[key] ?? ""))) && Object.keys(record).length === 6;
}
function luminance(color: string) {
  const channels = color.slice(1).match(/../g)!.map((hex) => Number.parseInt(hex,16)/255).map((v) => v <= .03928 ? v/12.92 : ((v+.055)/1.055) ** 2.4);
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
}
export function contrastRatio(a: string,b: string) { const values=[luminance(a),luminance(b)].sort((x,y)=>y-x); return (values[0]+.05)/(values[1]+.05); }
export function paletteWarnings(tokens: CustomPaletteTokens) {
  return [["Primary text / canvas",tokens.primary_text,tokens.canvas],["Primary text / surface",tokens.primary_text,tokens.surface],["Muted text / canvas",tokens.muted_text,tokens.canvas]]
    .filter(([,a,b])=>contrastRatio(a,b)<4.5).map(([label])=>`${label} has low contrast.`);
}
export function customPaletteStyle(tokens?: CustomPaletteTokens | null): CSSProperties | undefined {
  if (!tokens || !validPaletteTokens(tokens)) return undefined;
  return { "--canvas":tokens.canvas,"--surface":tokens.surface,"--surface-raised":tokens.surface,"--surface-muted":tokens.surface,"--surface-hover":tokens.surface,"--control-fill":tokens.canvas,"--text-primary":tokens.primary_text,"--text-secondary":tokens.muted_text,"--text-muted":tokens.muted_text,"--accent":tokens.primary_accent,"--accent-link":tokens.primary_accent,"--sidebar-accent":tokens.primary_accent,"--sidebar-accent-alt":tokens.secondary_accent,"--gold":tokens.secondary_accent } as CSSProperties;
}
import type { CSSProperties } from "react";
