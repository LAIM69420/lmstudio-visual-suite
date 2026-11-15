# metadata

Reads image metadata: dimensions, format, colour space, alpha, DPI, bit depth, EXIF, and ICC profile presence.

| | |
|---|---|
| Type | tools |
| Tools | 1 |
| Requires network | no |
| Requires external service | no |
| Destructive | no |
| Version | 1.0.1 |

## Tools

| Tool | What it does |
|---|---|
| `image_metadata` | Return a metadata summary for an image file |

## Requirements

| Requirement | Detail |
|---|---|
| Library | sharp / libvips |

## Configuration

No configuration fields.

Configured in LM Studio under Integrations → metadata; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Reads the file and reports what is embedded. EXIF can contain GPS coordinates, device serials, and timestamps — expect that to reach the model.

## Failure modes

| Symptom | Cause |
|---|---|
| No EXIF shown | Image has none, or the container stripped it |
| Wrong dimensions | Orientation EXIF not applied; values are pre-rotation |

## Example prompts

- "When was this photo taken and on what camera?"
- "Does this PNG have an alpha channel?"

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
| Known gaps | none known |

## License

MIT
