# ocr

Extracts text from images with Tesseract.js, including multi-language images.

| | |
|---|---|
| Type | tools |
| Tools | 1 |
| Requires network | no |
| Requires external service | no |
| Destructive | no |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `image_ocr` | Run OCR on an image and return the recognised text |

## Requirements

| Requirement | Detail |
|---|---|
| Language data | Tesseract traineddata downloaded on first use — needs network once |

## Configuration

No configuration fields; language is a per-call argument.

Configured in LM Studio under Integrations → ocr; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Reads image files and returns their text. Screenshots of password managers or chat windows become model context; there is no redaction.

## Failure modes

| Symptom | Cause |
|---|---|
| Empty result | Low contrast, rotated text, or missing language pack |
| Slow first run | Traineddata download |

## Example prompts

- "Extract the text from this screenshot."
- "Read the table in this PNG."

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
