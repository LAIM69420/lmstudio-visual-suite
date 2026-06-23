import { tool, type PluginContext, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { createWorker } from "tesseract.js";

const SUPPORTED = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff"];

const LANGUAGES = [
  "eng", "ara", "bul", "cat", "ces", "chi_sim", "chi_tra", "dan", "deu", "ell",
  "epo", "est", "eus", "fin", "fra", "glg", "heb", "hin", "hrv", "hun",
  "ind", "isl", "ita", "jpn", "kor", "lav", "lit", "nld", "nor", "pol",
  "por", "ron", "rus", "slk", "slv", "spa", "swe", "tha", "tur", "ukr",
  "vie",
] as const;

export async function main(ctx: PluginContext) {
  ctx.withToolsProvider(async () => {
    const ocrTool = tool({
      name: "image_ocr",
      description:
        "Extract text from an image using Optical Character Recognition (OCR). Supports 40+ languages. First call downloads the language data (~5-15MB on first use).",
      parameters: {
        imagePath: z.string().min(1).describe("Absolute path to the image file"),
        language: z.enum(LANGUAGES).default("eng").describe("Language code for OCR (e.g. eng, fra, jpn, chi_sim)"),
      },
      async implementation({ imagePath, language }) {
        if (!fs.existsSync(imagePath)) return `❌ File not found: ${imagePath}`;
        const ext = path.extname(imagePath).toLowerCase();
        if (!SUPPORTED.includes(ext)) return `❌ Unsupported format: ${ext}`;

        try {
          const worker = await createWorker(language);

          const { data } = await worker.recognize(imagePath);
          await worker.terminate();

          const text = data.text?.trim();
          if (!text) return `📄 OCR (${language}) — No text found in ${path.basename(imagePath)}.`;

          const wordCount = text.split(/\s+/).length;
          const confidence = data.confidence !== undefined
            ? `${data.confidence.toFixed(1)}%`
            : "N/A";

          return [
            `📄 OCR Result — ${path.basename(imagePath)}`,
            `   Language: ${language}  |  Words: ${wordCount}  |  Confidence: ${confidence}`,
            "",
            text.slice(0, 10000),  // cap at 10k chars
            text.length > 10000 ? `\n… [truncated, ${text.length - 10000} more chars]` : "",
          ].filter(Boolean).join("\n");
        } catch (e: any) {
          return `❌ OCR failed: ${e.message || e}`;
        }
      },
    });

    return [ocrTool];
  });
}
