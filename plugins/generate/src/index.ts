import { createConfigSchematics, tool, type PluginContext, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// ── Config ────────────────────────────────────────────────────────────────

const configSchematics = createConfigSchematics()
  .field("provider", "string", {}, "auto")
  .field("baseUrl", "string", {}, "http://localhost:7860")
  .field("apiKey", "string", { isProtected: true }, "")
  .field("defaultModel", "string", {}, "")
  .field("outputDir", "string", {}, path.join(process.env.HOME || "/tmp", "Pictures", "generated"))
  .build();

// ── Provider helpers ──────────────────────────────────────────────────────

async function generateSDWebUI(prompt: string, opts: {
  baseUrl: string; negative?: string; steps?: number; cfg?: number; width?: number; height?: number;
}): Promise<Buffer> {
  const payload = {
    prompt,
    negative_prompt: opts.negative || "",
    steps: opts.steps ?? 20,
    cfg_scale: opts.cfg ?? 7,
    width: opts.width ?? 512,
    height: opts.height ?? 512,
  };
  const resp = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`SD API error: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as { images: string[] };
  if (!data.images?.[0]) throw new Error("No image returned from SD API");
  return Buffer.from(data.images[0], "base64");
}

async function generateReplicate(prompt: string, opts: {
  apiKey: string; model?: string; width?: number; height?: number;
}): Promise<Buffer> {
  const model = opts.model || "stability-ai/stable-diffusion-3.5-large:latest";
  const resp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      version: model,
      input: { prompt, width: opts.width ?? 1024, height: opts.height ?? 1024 },
    }),
  });
  if (!resp.ok) throw new Error(`Replicate API error: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as { urls?: { get: string }; id: string };

  // Poll for completion
  const getUrl = data.urls?.get || `https://api.replicate.com/v1/predictions/${data.id}`;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${opts.apiKey}` },
    });
    const result = (await poll.json()) as { status?: string; output?: string[] };
    if (result.status === "succeeded" && result.output?.[0]) {
      const imgResp = await fetch(result.output[0]);
      if (!imgResp.ok) throw new Error("Failed to download generated image");
      const buf = Buffer.from(await imgResp.arrayBuffer());
      return buf;
    }
    if (result.status === "failed") throw new Error("Replicate generation failed");
  }
  throw new Error("Replicate generation timed out");
}

async function generateOpenAI(prompt: string, opts: {
  apiKey: string; model?: string; size?: string;
}): Promise<Buffer> {
  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model || "dall-e-3",
      prompt,
      n: 1,
      size: opts.size || "1024x1024",
      response_format: "b64_json",
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI API error: ${resp.status} ${resp.statusText}`);
  const data = (await resp.json()) as { data: { b64_json: string }[] };
  if (!data.data?.[0]?.b64_json) throw new Error("No image returned from OpenAI");
  return Buffer.from(data.data[0].b64_json, "base64");
}

async function saveImage(buf: Buffer, outputDir: string, prompt: string): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = Date.now();
  const slug = prompt.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
  const filename = `${timestamp}-${slug}.png`;
  const filepath = path.join(outputDir, filename);
  await fs.writeFile(filepath, buf);
  return filepath;
}

// ── Plugin entry ──────────────────────────────────────────────────────────

export async function main(ctx: PluginContext) {
  ctx.withConfigSchematics(configSchematics);
  ctx.withToolsProvider(async (ctl) => {
    const config = ctl.getPluginConfig(configSchematics);
    const provider = config.get("provider");
    const baseUrl = config.get("baseUrl");
    const apiKey = config.get("apiKey");
    const defaultModel = config.get("defaultModel");
    const outputDir = config.get("outputDir");

    const genTool = tool({
      name: "image_generate",
      description:
        "Generate an image from a text prompt. Supports local Stable Diffusion (auto-detected), Replicate, and OpenAI/DALL-E. Configure provider, base URL, and API key in plugin settings.",
      parameters: {
        prompt: z.string().min(1).max(2000).describe("Text description of the image to generate"),
        negativePrompt: z.string().optional().describe("What not to include (SD only)"),
        steps: z.number().int().min(1).max(150).default(20).describe("Inference steps (SD only)"),
        cfg: z.number().min(1).max(30).default(7).describe("CFG scale (SD only)"),
        width: z.number().int().min(64).max(2048).default(1024).describe("Image width"),
        height: z.number().int().min(64).max(2048).default(1024).describe("Image height"),
        model: z.string().optional().describe("Model override (provider-specific)"),
      },
      async implementation({ prompt, negativePrompt, steps, cfg, width, height, model }) {
        let buf: Buffer;
        const effectiveProvider = model && !provider || provider === "auto" ? "auto" : provider;

        try {
          if (effectiveProvider === "auto" || effectiveProvider === "sd-webui") {
            buf = await generateSDWebUI(prompt, {
              baseUrl, negative: negativePrompt, steps, cfg, width, height,
            });
          } else if (effectiveProvider === "replicate") {
            if (!apiKey) return "⚠️ Replicate API key not configured. Set it in plugin settings.";
            buf = await generateReplicate(prompt, { apiKey, model, width, height });
          } else if (effectiveProvider === "openai") {
            if (!apiKey) return "⚠️ OpenAI API key not configured. Set it in plugin settings.";
            buf = await generateOpenAI(prompt, { apiKey, model, size: `${width}x${height}` });
          } else {
            // Try SD first, fallback to OpenAI
            try {
              buf = await generateSDWebUI(prompt, {
                baseUrl, negative: negativePrompt, steps, cfg, width, height,
              });
            } catch {
              if (!apiKey) throw new Error("No API key configured and SD WebUI not reachable");
              buf = await generateOpenAI(prompt, { apiKey, model, size: `${width}x${height}` });
            }
          }
        } catch (e: any) {
          return `❌ Generation failed: ${e.message || e}`;
        }

        const filepath = await saveImage(buf, outputDir, prompt);
        const sizeKb = (buf.length / 1024).toFixed(1);
        return [
          `✅ Image generated and saved`,
          `   File: ${filepath}`,
          `   Size: ${width}×${height}  |  ${sizeKb} KB`,
          `   Prompt: ${prompt.slice(0, 120)}${prompt.length > 120 ? "…" : ""}`,
        ].join("\n");
      },
    });

    return [genTool];
  });
}
