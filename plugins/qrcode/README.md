# qrcode

Encodes text into QR codes as SVG and decodes QR codes from image paths or URLs.

| | |
|---|---|
| Type | tools |
| Tools | 2 |
| Requires network | yes |
| Requires external service | no |
| Destructive | no |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `qrcode_decode` | Decode a QR image by path or URL |
| `qrcode_encode` | Render a string as a QR code (SVG) |

## Requirements

| Requirement | Detail |
|---|---|
| Network | Only for decoding from an HTTP(S) URL |

## Configuration

`moduleSize`, `quietZone`.

Configured in LM Studio under Integrations → qrcode; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Decoding a URL fetches it. A QR payload is untrusted input: it may be a URL, a payment request, or a Wi-Fi credential — treat decoded content as hostile.

## Failure modes

| Symptom | Cause |
|---|---|
| Decode fails | Image too small, blurred, or not actually a QR code |

## Example prompts

- "Make a QR code for this URL."
- "What does the QR code in this image say?"

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
