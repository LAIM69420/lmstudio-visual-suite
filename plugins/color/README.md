# color

Colour utilities: convert between hex, RGB, and HSL, generate palettes, and check contrast against WCAG.

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
| `color_tool` | Convert, generate palettes, and compute contrast ratios |

## Requirements

| Requirement | Detail |
|---|---|
| None | Pure computation |

## Configuration

`defaultPaletteSize`.

Configured in LM Studio under Integrations → color; field definitions live in `src/configSchematics.ts`.

## Privileged surface

None. No file or network access.

## Failure modes

| Symptom | Cause |
|---|---|
| Unable to parse colour | Input is not hex or `rgb(...)` |

## Example prompts

- "What is #FF8800 in HSL?"
- "Does this text colour have enough contrast on white?"

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
