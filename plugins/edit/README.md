# edit

Deterministic image edits: resize, crop, convert format, and apply filters.

| | |
|---|---|
| Type | tools |
| Tools | 4 |
| Requires network | no |
| Requires external service | no |
| Destructive | yes |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `image_convert` | Convert between PNG, JPEG, WebP, AVIF, TIFF |
| `image_crop` | Crop to a rectangle |
| `image_filter` | Apply a named filter (grayscale, blur, sharpen, ...) |
| `image_resize` | Scale to exact or bounded dimensions |

## Requirements

| Requirement | Detail |
|---|---|
| Formats | Whatever libvips was built with; AVIF/TIFF depend on the sharp build |

## Configuration

No configuration fields — each tool takes its parameters per call.

Configured in LM Studio under Integrations → edit; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Writes files next to the input unless a destination is given. No network access.

## Failure modes

| Symptom | Cause |
|---|---|
| Unsupported output format | Current sharp build lacks that encoder |
| Crop out of bounds | Rectangle exceeds source dimensions |

## Example prompts

- "Resize this to 1920px wide."
- "Convert these three PNGs to WebP."

## Development

```bash
npm install    # also runs `lms dev --install`
npm run build  # tsc
node scripts/smoke.mjs   # from the suite root
```

## Status

| Item | State |
|---|---|
| Compiles | yes — verified with `tsc --noEmit` against the current toolchain |
| Tests | smoke harness: manifest validation + tool inventory |
| Verified against | LM Studio 0.4.28 |
| Known gaps | no behavioural tests; docs written from source review |

## License

MIT
