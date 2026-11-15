# lmstudio-visual-suite

LM Studio plugins for image work: generation, description, classification, editing, OCR, metadata, colour utilities, QR codes, and screenshots.

Eight plugins in one repo. `color` was later reimplemented as an MCP server in [`mcp-visual-suite`](https://github.com/LAIM69420/mcp-visual-suite); the plugin here is the standalone equivalent.

## Plugins

| Plugin | Tools | Requires | Notes |
|---|---|---|---|
| [`generate`](plugins/generate) | `image_generate` | provider | Local Stable Diffusion (`127.0.0.1:7860`), Replicate, or OpenAI/DALL-E |
| [`analyze`](plugins/analyze) | `image_describe`, `image_classify` | vision model | Sends the image to an LM Studio vision endpoint |
| [`edit`](plugins/edit) | `image_resize`, `image_crop`, `image_convert`, `image_filter` | — | PNG, JPEG, WebP, AVIF, TIFF |
| [`ocr`](plugins/ocr) | `image_ocr` | — | Tesseract.js; multi-language |
| [`metadata`](plugins/metadata) | `image_metadata` | — | Dimensions, format, colour space, EXIF |
| [`color`](plugins/color) | `color_tool` | — | Hex/RGB/HSL conversion, palettes, contrast, WCAG |
| [`qrcode`](plugins/qrcode) | `qrcode_encode`, `qrcode_decode` | — | SVG output, decode from path or URL |
| [`screenshot`](plugins/screenshot) | `screenshot`, `screenshot_displays` | display server | Full screen, active window, or region |

## Install

```bash
cd plugins/<name>
npm install    # runs `lms dev --install --yes`
npm run build
```

## Requirements

- `analyze`: an LM Studio vision model loaded and reachable (configurable base URL, default `http://localhost:1234`)
- `generate`: at least one provider configured — local SD web UI, Replicate token, or OpenAI key
- `screenshot`: an X11 or Wayland session; headless hosts will fail

## Privileged surface

- `screenshot` captures whatever is on screen. On a shared or remote display that includes other people's content.
- `generate` stores API keys in plugin config; `baseUrl` can be pointed at any host.
- No plugin here writes outside its configured output directory.

## Overlap note

`mcp-visual-suite` exposes an equivalent tool set (`image_describe`, `image_classify`, `image_metadata`, `image_ocr`, `image_resize`, `image_crop`, `image_convert`, `image_filter`, `screenshot`, `screenshot_displays`, plus `generate_image` for OpenAI/Replicate).

**Do not install both** unless you deliberately want two tool sets in the model's context. The practical split:

- Keep `mcp-visual-suite` if you also use non-LM-Studio MCP clients.
- Keep the local `generate` plugin regardless if you use **local Stable Diffusion** — the MCP server covers only OpenAI and Replicate.

## Conventions

- Config via `createConfigSchematics`; secrets use `{ isProtected: true }`.
- `withToolsProvider(async (ctl) => ...)` — use `ctl.getPluginConfig`, not `ctx.getPluginConfig`.

## Status

| Item | State |
|---|---|
| Tests | none |
| Last verified | built against `@lmstudio/sdk` 1.5.0 (2026-06-23); running app is 0.4.28 |
| Known gaps | `color` had a compile error from a spread of `Object.values()` (fixed); no per-plugin READMEs yet |

## License

MIT
