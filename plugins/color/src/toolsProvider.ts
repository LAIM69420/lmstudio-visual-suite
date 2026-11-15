import { tool, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";

import { buildConfigSchematics } from "./configSchematics.js";

const configSchematics = buildConfigSchematics();

// ---------------------------------------------------------------------------
// Color math helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean) && !/^[0-9a-fA-F]{3}$/.test(clean)) return null;
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      case bn: h = ((rn - gn) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sNorm = s / 100, lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lNorm - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrastRatio(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function generatePalette(h: number, s: number, l: number, count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (h + i * (360 / count)) % 360;
    const lightness = Math.max(20, Math.min(80, l + (i % 3 - 1) * 15));
    const { r, g, b } = hslToRgb(hue, s, lightness);
    colors.push(rgbToHex(r, g, b));
  }
  return colors;
}

function wcagLevel(ratio: number): string {
  if (ratio >= 7) return "AAA (excellent)";
  if (ratio >= 4.5) return "AA (good)";
  if (ratio >= 3) return "AA Large (minimal)";
  return "Fail";
}

// ---------------------------------------------------------------------------
// Tools provider
// ---------------------------------------------------------------------------

export const toolsProvider: ToolsProvider = async (ctl) => {
  const config = ctl.getPluginConfig(configSchematics);
  const defaultPaletteSize: number = config.get("defaultPaletteSize");

  const colorTool = tool({
    name: "color_tool",
    description: [
      "Color conversion, palette generation, contrast checking, and WCAG compliance.",
      "Supports hex (#FF8800), RGB, HSL, and HWB formats.",
    ].join(" "),
    parameters: {
      action: z
        .enum(["convert", "palette", "contrast"] as const)
        .describe("'convert': parse and show a color in all formats. 'palette': generate a palette. 'contrast': check WCAG contrast between two colors."),
      color: z
        .string()
        .optional()
        .describe("Color value for 'convert' or base color for 'palette' (hex, rgb, or hsl)"),
      color2: z
        .string()
        .optional()
        .describe("Second color for 'contrast' action"),
      count: z
        .number()
        .int()
        .min(2)
        .max(10)
        .optional()
        .describe("Number of colors for palette (default: configured value)"),
    },
    async implementation({ action, color, color2, count }) {
      switch (action) {
        case "convert": {
          if (!color) return "A 'color' parameter is required for 'convert'.";
          // Try hex first
          const match = color.match(/#?([0-9a-fA-F]{3,8})/);
          let rgb: { r: number; g: number; b: number } | null = null;
          if (match) {
            rgb = hexToRgb(match[1].length >= 6 ? match[1] : color);
          }
          if (!rgb) {
            // Try "rgb(r,g,b)" format
            const rgbMatch = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
            if (rgbMatch) {
              rgb = { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
            }
          }
          if (!rgb) return `Unable to parse color: "${color}". Try hex (#FF8800) or rgb(r,g,b) format.`;

          const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
          return [
            `Color: ${rgbToHex(rgb.r, rgb.g, rgb.b)}`,
            `RGB: rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
            `HSL: hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
          ].join("\n");
        }

        case "palette": {
          if (!color) return "A base 'color' is required for 'palette'.";
          const baseRgb = hexToRgb(color.replace(/^#/, ""));
          if (!baseRgb) return `Unable to parse color: "${color}".`;
          const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
          const paletteSize = count ?? defaultPaletteSize;
          const palette = generatePalette(baseHsl.h, baseHsl.s, baseHsl.l, paletteSize);
          return [
            `Palette based on ${rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b)}:`,
            ...palette.map((c, i) => {
              const cRgb = hexToRgb(c);
              const hue = cRgb ? rgbToHsl(cRgb.r, cRgb.g, cRgb.b).h : 0;
              return `  ${i + 1}. ${c} — ${hue}°`;
            }),
          ].join("\n");
        }

        case "contrast": {
          if (!color || !color2) return "Both 'color' and 'color2' are required for 'contrast'.";
          const c1 = hexToRgb(color.replace(/^#/, ""));
          const c2 = hexToRgb(color2.replace(/^#/, ""));
          if (!c1) return `Unable to parse first color: "${color}".`;
          if (!c2) return `Unable to parse second color: "${color2}".`;
          const ratio = contrastRatio(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
          return [
            `Contrast ratio: ${ratio.toFixed(2)}:1`,
            `  ${rgbToHex(c1.r, c1.g, c1.b)} vs ${rgbToHex(c2.r, c2.g, c2.b)}`,
            `WCAG: ${wcagLevel(ratio)}`,
            ratio >= 4.5
              ? "✓ Passes AA for normal text."
              : "✗ Fails AA for normal text (need 4.5:1).",
            ratio >= 3
              ? "✓ Passes AA for large text (18px+ bold or 24px+)."
              : "✗ Fails AA for large text (need 3:1).",
          ].join("\n");
        }

        default:
          return "Unknown action. Use: convert, palette, or contrast.";
      }
    },
  });

  return [colorTool];
};
