import { tool, type ToolsProvider } from "@lmstudio/sdk";
import { z } from "zod";
import { execSync, type ExecSyncOptions } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { buildConfigSchematics } from "./configSchematics.js";

const configSchematics = buildConfigSchematics();

// ---------------------------------------------------------------------------
// Screenshot tool detection (Linux)
// ---------------------------------------------------------------------------

type CaptureTool = "scrot" | "maim" | "import" | "screencapture" | "powershell" | null;

function detectTool(): CaptureTool {
  const isLinux = process.platform === "linux";
  const isMac = process.platform === "darwin";
  const isWin = process.platform === "win32";

  if (isMac) return "screencapture";
  if (isWin) return "powershell";

  if (isLinux) {
    try {
      execSync("which scrot", { stdio: "ignore" });
      return "scrot";
    } catch {}
    try {
      execSync("which maim", { stdio: "ignore" });
      return "maim";
    } catch {}
    try {
      execSync("which import", { stdio: "ignore" });
      return "import";
    } catch {}
  }

  return null;
}

// ---------------------------------------------------------------------------
// Capture functions
// ---------------------------------------------------------------------------

function captureScrot(output: string, region?: string): void {
  const args = ["-z"];
  if (region === "window") args.push("-u");
  else if (region && region !== "screen") args.push("-a", region); // WxH+X+Y
  execSync(`scrot ${args.join(" ")} "${output}"`, { stdio: "pipe", timeout: 15000 });
}

function captureMaim(output: string, region?: string): void {
  const args: string[] = [];
  if (region === "window") args.push("-i", "$(xdotool getactivewindow)");
  else if (region && region !== "screen") args.push("-g", region);
  execSync(`maim ${args.join(" ")} "${output}"`, { stdio: "pipe", timeout: 15000 });
}

function captureImport(output: string, region?: string): void {
  const args = ["-quality", "95"];
  if (region === "window") args.push("-window", "root");
  else if (region && region !== "screen") args.push("-crop", region);
  execSync(`import ${args.join(" ")} "${output}"`, { stdio: "pipe", timeout: 15000 });
}

function captureScreencapture(output: string, region?: string): void {
  const args: string[] = ["-x"];
  if (region === "window") args.push("-w");
  else if (region === "screen") args.push("-T0");
  if (region && region !== "screen" && region !== "window") {
    args.push("-r"); // capture region
  }
  execSync(`screencapture ${args.join(" ")} "${output}"`, { stdio: "pipe", timeout: 15000 });
}

function capturePowershell(output: string, _region?: string): void {
  execSync(
    `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $s = [Windows.Forms.Screen]::PrimaryScreen.Bounds; $b = New-Object Drawing.Bitmap $s.Width, $s.Height; $g = [Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($s.X, $s.Y, 0, 0, $s.Size); $b.Save('${output}')"`,
    { stdio: "pipe", timeout: 30000 }
  );
}

// ---------------------------------------------------------------------------
// Main capture function
// ---------------------------------------------------------------------------

function takeScreenshot(output: string, region: string | undefined, tool: CaptureTool): boolean {
  switch (tool) {
    case "scrot":        captureScrot(output, region); return true;
    case "maim":         captureMaim(output, region); return true;
    case "import":       captureImport(output, region); return true;
    case "screencapture": captureScreencapture(output, region); return true;
    case "powershell":   capturePowershell(output, region); return true;
    default:             return false;
  }
}

// ---------------------------------------------------------------------------
// Display detection
// ---------------------------------------------------------------------------

function detectDisplays(): string[] {
  if (process.platform === "linux") {
    try {
      const out = execSync("xrandr --query 2>/dev/null", { encoding: "utf-8", timeout: 5000 });
      return out
        .split("\n")
        .filter((l) => l.includes(" connected"))
        .map((l) => {
          const parts = l.split(/\s+/);
          const resMatch = l.match(/(\d+x\d+)/);
          return `${parts[0]} — ${resMatch ? resMatch[1] : "?"}`;
        });
    } catch {}
  }
  if (process.platform === "darwin") {
    try {
      const out = execSync("system_profiler SPDisplaysDataType 2>/dev/null", {
        encoding: "utf-8", timeout: 5000,
      });
      return out
        .split("\n")
        .filter((l) => l.includes("Resolution"))
        .map((l) => l.trim());
    } catch {}
  }
  return ["Primary display"];
}

// ---------------------------------------------------------------------------
// Tools provider
// ---------------------------------------------------------------------------

export const toolsProvider: ToolsProvider = async (ctl) => {
  const config = ctl.getPluginConfig(configSchematics);
  const outputDir: string = path.resolve(config.get("outputDir"));
  const preferredTool: string = config.get("preferredTool");

  const screenshotTool = tool({
    name: "screenshot",
    description: [
      "Take a screenshot and save it as a PNG file.",
      "Options: screen (full), window (active window), or a geometry string like 800x600+100+50.",
    ].join(" "),
    parameters: {
      region: z.string().default("screen").describe("Capture region: 'screen', 'window', or geometry (WxH+X+Y)"),
      filename: z.string().optional().describe("Output filename (default: screenshot-<timestamp>.png)"),
    },
    async implementation({ region, filename }) {
      await fs.mkdir(outputDir, { recursive: true });

      const name = filename ?? `screenshot-${Date.now()}.png`;
      const outPath = path.join(outputDir, name);

      const tool = preferredTool !== "auto" ? (preferredTool as CaptureTool) : detectTool();

      if (!tool) {
        return [
          "No screenshot tool detected on this system.",
          "",
          "Install one of:",
          "  sudo apt install scrot      (recommended, lightweight)",
          "  sudo apt install maim       (feature-rich)",
          "  sudo apt install imagemagick (provides 'import')",
          "",
          "On macOS: built-in screencapture is used automatically.",
        ].join("\n");
      }

      try {
        takeScreenshot(outPath, region === "screen" ? undefined : region, tool);
        const stat = await fs.stat(outPath);
        return `Screenshot saved: ${outPath}\nSize: ${(stat.size / 1024).toFixed(1)} KB\nRegion: ${region}\nTool: ${tool}`;
      } catch (err: unknown) {
        return `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const displaysTool = tool({
    name: "screenshot_displays",
    description: "List available displays/screens for screenshot capture.",
    parameters: {},
    async implementation() {
      const displays = detectDisplays();
      return displays.length > 0
        ? `Displays:\n${displays.map((d, i) => `  ${i + 1}. ${d}`).join("\n")}`
        : "Could not detect displays. Try running with 'screen' region.";
    },
  });

  return [screenshotTool, displaysTool];
};
