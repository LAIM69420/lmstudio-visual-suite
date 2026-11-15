import { createConfigSchematics, tool, type PluginContext, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Config ────────────────────────────────────────────────────────────────

const configSchematics = createConfigSchematics()
  .field("baseUrl", "string", {}, "http://localhost:1234")
  .field("apiKey", "string", { isProtected: true }, "")
  .field("model", "string", {}, "")
  .build();

// ── Image helpers ─────────────────────────────────────────────────────────

function imageToBase64(filepath: string): string {
  const buf = fs.readFileSync(filepath);
  const ext = path.extname(filepath).toLowerCase();
  const mime: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
  };
  const mimeType = mime[ext] || "image/png";
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

async function callVisionAPI(opts: {
  baseUrl: string; apiKey: string; model: string;
  imageBase64: string; prompt: string; maxTokens?: number;
}): Promise<string> {
  const model = opts.model || "gpt-4o-mini";
  const url = `${opts.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.apiKey) headers["Authorization"] = `Bearer ${opts.apiKey}`;

  const body = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: opts.prompt },
          { type: "image_url", image_url: { url: opts.imageBase64 } },
        ],
      },
    ],
    max_tokens: opts.maxTokens ?? 1024,
  };

  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Vision API error ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content || "No response from vision model.";
}

// ── Plugin entry ──────────────────────────────────────────────────────────

export async function main(ctx: PluginContext) {
  ctx.withConfigSchematics(configSchematics);
  ctx.withToolsProvider(async (ctl) => {
    const config = ctl.getPluginConfig(configSchematics);
    const baseUrl = config.get("baseUrl");
    const apiKey = config.get("apiKey");
    const model = config.get("model");

    // ── Describe ────────────────────────────────────────────────────────────
    const describeTool = tool({
      name: "image_describe",
      description:
        "Describe the contents of an image using a vision-capable model. Returns a detailed natural-language description. Supports PNG, JPEG, GIF, WebP, BMP.",
      parameters: {
        imagePath: z.string().min(1).describe("Absolute path to the image file"),
        prompt: z.string().optional().default("Describe this image in detail.").describe("Custom prompt or question about the image"),
      },
      async implementation({ imagePath, prompt }) {
        if (!fs.existsSync(imagePath)) return `❌ File not found: ${imagePath}`;

        const ext = path.extname(imagePath).toLowerCase();
        const supported = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];
        if (!supported.includes(ext)) return `❌ Unsupported image format: ${ext}. Supported: ${supported.join(", ")}`;

        try {
          const b64 = imageToBase64(imagePath);
          const description = await callVisionAPI({
            baseUrl, apiKey, model, imageBase64: b64, prompt, maxTokens: 2048,
          });
          return [
            `📋 Image Analysis — ${path.basename(imagePath)}`,
            "",
            description,
          ].join("\n");
        } catch (e: any) {
          return `❌ Analysis failed: ${e.message || e}`;
        }
      },
    });

    // ── Classify ────────────────────────────────────────────────────────────
    const classifyTool = tool({
      name: "image_classify",
      description:
        "Classify an image into predefined categories or detect specific objects. Provide a comma-separated list of categories to choose from.",
      parameters: {
        imagePath: z.string().min(1).describe("Absolute path to the image file"),
        categories: z.string().optional().default("object, scene, people, animal, food, text, vehicle, nature, technology, art").describe("Comma-separated list of categories to classify into"),
      },
      async implementation({ imagePath, categories }) {
        if (!fs.existsSync(imagePath)) return `❌ File not found: ${imagePath}`;

        const catList = categories.split(",").map((c) => c.trim()).filter(Boolean);
        const prompt = [
          `Classify this image into one or more of the following categories: ${catList.join(", ")}.`,
          "Respond with ONLY the matching category names, one per line. If none match, say 'Other'.",
          "Then briefly explain why in one sentence.",
        ].join(" ");

        try {
          const b64 = imageToBase64(imagePath);
          const result = await callVisionAPI({
            baseUrl, apiKey, model, imageBase64: b64, prompt, maxTokens: 512,
          });
          return [
            `🏷️ Image Classification — ${path.basename(imagePath)}`,
            "",
            result,
          ].join("\n");
        } catch (e: any) {
          return `❌ Classification failed: ${e.message || e}`;
        }
      },
    });

    return [describeTool, classifyTool];
  });
}
