import { tool, type PluginContext, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

const SUPPORTED = [".png", ".jpg", ".jpeg", ".webp", ".avif", ".tiff", ".bmp", ".gif"];

export async function main(ctx: PluginContext) {
  ctx.withToolsProvider(async () => {
    const metadataTool = tool({
      name: "image_metadata",
      description:
        "Read metadata from an image: dimensions, format, file size, color space, alpha channel, and EXIF data (if available).",
      parameters: {
        imagePath: z.string().min(1).describe("Absolute path to the image file"),
      },
      async implementation({ imagePath }) {
        if (!fs.existsSync(imagePath)) return `❌ File not found: ${imagePath}`;
        const ext = path.extname(imagePath).toLowerCase();
        if (!SUPPORTED.includes(ext)) return `❌ Unsupported format: ${ext}`;

        try {
          const stat = fs.statSync(imagePath);
          const meta = await sharp(imagePath).metadata();

          const lines: string[] = [
            `📋 Image Metadata — ${path.basename(imagePath)}`,
            "",
            `   📁 File size: ${(stat.size / 1024).toFixed(1)} KB`,
          ];

          if (meta.format) lines.push(`   🖼️  Format: ${meta.format}`);
          if (meta.width && meta.height) {
            lines.push(`   📐 Dimensions: ${meta.width} × ${meta.height} px`);
            const megapixels = ((meta.width * meta.height) / 1_000_000).toFixed(2);
            lines.push(`   🔲 Megapixels: ${megapixels} MP`);
          }
          if (meta.space) lines.push(`   🎨 Color space: ${meta.space}`);
          if (meta.channels) lines.push(`   🌈 Channels: ${meta.channels}`);
          if (meta.hasAlpha !== undefined) lines.push(`   🔍 Alpha channel: ${meta.hasAlpha ? "Yes" : "No"}`);
          if (meta.density) lines.push(`   📏 DPI: ${meta.density}`);
          if (meta.depth) lines.push(`   🧬 Bit depth: ${meta.depth}`);

          // EXIF
          if (meta.exif) {
            try {
              const tags = meta.exif;
              lines.push("", `   📷 EXIF data (${tags.length} bytes)`);

              // Extract common EXIF fields
              const exifStr = tags.toString("utf-8");
              const make = exifStr.match(/Make[^\0]*?\0([^\0]+)/)?.[1];
              const model = exifStr.match(/Model[^\0]*?\0([^\0]+)/)?.[1];
              const date = exifStr.match(/(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/)?.[1];

              if (make) lines.push(`   📷 Camera: ${make}${model ? ` ${model}` : ""}`);
              if (date) lines.push(`   🕐 Date: ${date.replace(/:/g, "-").replace(" ", "T")}`);
            } catch {
              // EXIF parse failed, skip
            }
          }

          if (meta.icc) lines.push(`   🎯 ICC profile: embedded (${meta.icc.length} bytes)`);

          return lines.join("\n");
        } catch (e: any) {
          return `❌ Metadata read failed: ${e.message || e}`;
        }
      },
    });

    return [metadataTool];
  });
}
