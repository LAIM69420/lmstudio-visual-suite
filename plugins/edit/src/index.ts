import { tool, type PluginContext, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import sharp from "sharp";

// ── Supported formats ─────────────────────────────────────────────────────

const SUPPORTED_INPUTS = [".png", ".jpg", ".jpeg", ".webp", ".avif", ".tiff", ".bmp"];
const SUPPORTED_OUTPUTS = ["png", "jpeg", "webp", "avif", "tiff"] as const;

type OutputFormat = (typeof SUPPORTED_OUTPUTS)[number];

// ── Helpers ───────────────────────────────────────────────────────────────

function checkFile(filepath: string): string | null {
  if (!fs.existsSync(filepath)) return `❌ File not found: ${filepath}`;
  const ext = path.extname(filepath).toLowerCase();
  if (!SUPPORTED_INPUTS.includes(ext)) return `❌ Unsupported format: ${ext}`;
  return null;
}

function outputPath(inputPath: string, format: string, suffix: string): string {
  const dir = path.dirname(inputPath);
  const name = path.basename(inputPath, path.extname(inputPath));
  return path.join(dir, `${name}_${suffix}.${format}`);
}

// ── Plugin entry ──────────────────────────────────────────────────────────

export async function main(ctx: PluginContext) {
  ctx.withToolsProvider(async () => {
    // ── Resize ──────────────────────────────────────────────────────────────
    const resizeTool = tool({
      name: "image_resize",
      description:
        "Resize an image to the given width and height. Aspect ratio is preserved by default; set fit=false to force exact dimensions.",
      parameters: {
        imagePath: z.string().min(1).describe("Absolute path to the image file"),
        width: z.number().int().min(1).max(10000).describe("Target width in pixels"),
        height: z.number().int().min(1).max(10000).describe("Target height in pixels"),
        fit: z.boolean().default(true).describe("Preserve aspect ratio (true=cover/contain, false=stretch)"),
        format: z.enum(SUPPORTED_OUTPUTS).optional().describe("Output format (default: same as input)"),
      },
      async implementation({ imagePath, width, height, fit, format }) {
        const err = checkFile(imagePath);
        if (err) return err;

        try {
          const ext = format || path.extname(imagePath).replace(".", "");
          const outPath = outputPath(imagePath, ext, `${width}x${height}`);

          let pipeline = sharp(imagePath).resize(width, height, {
            fit: fit ? "cover" : "fill",
            withoutEnlargement: false,
          });

          await pipeline.toFile(outPath);
          const stat = fs.statSync(outPath);
          return `✅ Resized to ${width}×${height}\n   Saved: ${outPath}\n   Size: ${(stat.size / 1024).toFixed(1)} KB`;
        } catch (e: any) {
          return `❌ Resize failed: ${e.message || e}`;
        }
      },
    });

    // ── Crop ────────────────────────────────────────────────────────────────
    const cropTool = tool({
      name: "image_crop",
      description:
        "Crop a region from an image. Specify the top-left corner (x, y) and the width and height of the crop area.",
      parameters: {
        imagePath: z.string().min(1).describe("Absolute path to the image file"),
        x: z.number().int().min(0).describe("Left edge of crop region (pixels)"),
        y: z.number().int().min(0).describe("Top edge of crop region (pixels)"),
        width: z.number().int().min(1).describe("Width of crop region (pixels)"),
        height: z.number().int().min(1).describe("Height of crop region (pixels)"),
        format: z.enum(SUPPORTED_OUTPUTS).optional().describe("Output format"),
      },
      async implementation({ imagePath, x, y, width, height, format }) {
        const err = checkFile(imagePath);
        if (err) return err;

        try {
          const ext = format || path.extname(imagePath).replace(".", "");
          const outPath = outputPath(imagePath, ext, `crop${x}_${y}_${width}x${height}`);

          await sharp(imagePath).extract({ left: x, top: y, width, height }).toFile(outPath);
          const stat = fs.statSync(outPath);
          return `✅ Cropped (${x},${y}) → ${width}×${height}\n   Saved: ${outPath}\n   Size: ${(stat.size / 1024).toFixed(1)} KB`;
        } catch (e: any) {
          return `❌ Crop failed: ${e.message || e}`;
        }
      },
    });

    // ── Convert ─────────────────────────────────────────────────────────────
    const convertTool = tool({
      name: "image_convert",
      description:
        "Convert an image to a different format. Supports PNG, JPEG, WebP, AVIF, TIFF. Optionally set quality for lossy formats.",
      parameters: {
        imagePath: z.string().min(1).describe("Absolute path to the image file"),
        format: z.enum(SUPPORTED_OUTPUTS).describe("Target format"),
        quality: z.number().int().min(1).max(100).default(85).describe("Output quality (JPEG/WebP/AVIF only)"),
      },
      async implementation({ imagePath, format, quality }) {
        const err = checkFile(imagePath);
        if (err) return err;

        try {
          const outPath = outputPath(imagePath, format, "converted");

          let pipeline = sharp(imagePath);
          switch (format) {
            case "jpeg": pipeline = pipeline.jpeg({ quality }); break;
            case "webp": pipeline = pipeline.webp({ quality }); break;
            case "avif": pipeline = pipeline.avif({ quality }); break;
            case "tiff": pipeline = pipeline.tiff(); break;
            case "png": pipeline = pipeline.png(); break;
          }

          await pipeline.toFile(outPath);
          const stat = fs.statSync(outPath);
          return `✅ Converted to ${format}\n   Saved: ${outPath}\n   Size: ${(stat.size / 1024).toFixed(1)} KB`;
        } catch (e: any) {
          return `❌ Conversion failed: ${e.message || e}`;
        }
      },
    });

    // ── Filter ──────────────────────────────────────────────────────────────
    const filterTool = tool({
      name: "image_filter",
      description:
        "Apply a visual filter to an image. Supported filters: grayscale, blur, sharpen, negate, tint, normalize, median.",
      parameters: {
        imagePath: z.string().min(1).describe("Absolute path to the image file"),
        filter: z.enum(["grayscale", "blur", "sharpen", "negate", "tint", "normalize", "median"]).describe("Filter type to apply"),
        intensity: z.number().min(0).max(100).default(5).describe("Filter intensity (blur sigma, sharpen sigma, median size)"),
        format: z.enum(SUPPORTED_OUTPUTS).optional().describe("Output format"),
      },
      async implementation({ imagePath, filter, intensity, format }) {
        const err = checkFile(imagePath);
        if (err) return err;

        try {
          const ext = format || path.extname(imagePath).replace(".", "");
          const outPath = outputPath(imagePath, ext, filter);

          let pipeline = sharp(imagePath);
          switch (filter) {
            case "grayscale":
              pipeline = pipeline.grayscale();
              break;
            case "blur":
              pipeline = pipeline.blur(Math.max(0.3, intensity));
              break;
            case "sharpen":
              pipeline = pipeline.sharpen(Math.max(0.3, intensity));
              break;
            case "negate":
              pipeline = pipeline.negate();
              break;
            case "tint":
              pipeline = pipeline.tint({
                r: Math.round(Math.min(255, intensity * 25)),
                g: Math.round(Math.min(255, intensity * 10)),
                b: Math.round(Math.min(255, intensity * 40)),
              });
              break;
            case "normalize":
              pipeline = pipeline.normalise();
              break;
            case "median":
              pipeline = pipeline.median(Math.max(1, Math.round(intensity)));
              break;
          }

          await pipeline.toFile(outPath);
          const stat = fs.statSync(outPath);
          return `✅ Applied filter: ${filter}\n   Saved: ${outPath}\n   Size: ${(stat.size / 1024).toFixed(1)} KB`;
        } catch (e: any) {
          return `❌ Filter failed: ${e.message || e}`;
        }
      },
    });

    return [resizeTool, cropTool, convertTool, filterTool];
  });
}
