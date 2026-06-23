import { tool, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";

import { buildConfigSchematics } from "./configSchematics.js";
import { qrEncode } from "./qrGenerator.js";

const configSchematics = buildConfigSchematics();

// ---------------------------------------------------------------------------
// Tools provider
// ---------------------------------------------------------------------------

export const toolsProvider: ToolsProvider = async (ctl) => {
  const config = ctl.getPluginConfig(configSchematics);
  // moduleSize and quietZone are primarily for future use or SVG fine-tuning
  // current qrGenerator uses fixed values internally

  const encodeTool = tool({
    name: "qrcode_encode",
    description: [
      "Generate a QR code from numeric data. Returns an SVG string that can be saved to an .svg file or rendered.",
      "Supports up to 41 digits (version 1, ECC level L).",
    ].join(" "),
    parameters: {
      data: z.string().min(1).max(200).describe("Data to encode in the QR code (digits only for QR numeric mode)"),
      filename: z.string().optional().describe("Optional filename to save the SVG to (e.g., qrcode.svg)"),
    },
    async implementation({ data, filename }) {
      const digits = data.replace(/[^0-9]/g, "");
      if (digits.length === 0) {
        return "QR code numeric mode requires at least one digit (0-9). Non-digit characters will be stripped.";
      }
      if (digits.length > 41) {
        return `Data too long: ${digits.length} digits (max 41 for version 1-L). Please shorten the input.`;
      }

      try {
        const svg = qrEncode(data);

        if (filename) {
          const fs = await import("node:fs/promises");
          const path = await import("node:path");
          const resolved = path.resolve(filename);
          await fs.writeFile(resolved, svg, "utf-8");
          return `QR code saved to ${resolved}\n\nPreview:\n\`\`\`svg\n${svg.slice(0, 800)}\n\`\`\``;
        }

        // Return SVG inline
        return `QR code generated (${digits.length} digits):\n\n\`\`\`svg\n${svg}\n\`\`\``;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Error generating QR code: ${msg}`;
      }
    },
  });

  const decodeTool = tool({
    name: "qrcode_decode",
    description: [
      "Decode a QR code from an image file path or URL.",
      "Reads the image, detects QR codes, and returns the decoded content.",
      "Note: Requires an installed QR decoder library (zbar) or falls back to instructing the user.",
    ].join(" "),
    parameters: {
      source: z.string().min(1).describe("Path to an image file containing a QR code, or a URL"),
    },
    async implementation({ source }) {
      // Attempt decoding via common system tools, otherwise guide the user
      try {
        const { execSync } = await import("node:child_process");

        // Try zbarimg first (most common)
        try {
          const output = execSync(`zbarimg -q --raw "${source}" 2>/dev/null`, {
            encoding: "utf-8",
            timeout: 10000,
          }).trim();
          if (output) return `Decoded content:\n\`\`\`\n${output}\n\`\`\``;
        } catch { /* fall through */ }

        // Try with python pyzbar
        try {
          const output = execSync(
            `python3 -c "import sys; from pyzbar.pyzbar import decode; from PIL import Image; print(decode(Image.open('${source}'))[0].data.decode())" 2>/dev/null`,
            { encoding: "utf-8", timeout: 15000 }
          ).trim();
          if (output) return `Decoded content:\n\`\`\`\n${output}\n\`\`\``;
        } catch { /* fall through */ }

        return [
          `Could not decode QR code from "${source}".`,
          "",
          "To enable QR decoding, install one of:",
          "  - `sudo apt install zbar-tools`  (provides zbarimg)",
          "  - `pip install pyzbar Pillow`    (Python decoder)",
          "",
          "Then try again — the tool will detect and use either automatically.",
        ].join("\n");
      } catch {
        return `Could not access "${source}". Make sure the file exists and is readable.`;
      }
    },
  });

  return [encodeTool, decodeTool];
};
