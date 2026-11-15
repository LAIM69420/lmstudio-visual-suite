# analyze

Describes and classifies images by sending them to an LM Studio vision model.

| | |
|---|---|
| Type | tools |
| Tools | 2 |
| Requires network | no |
| Requires external service | yes |
| Destructive | no |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `image_classify` | Assign categories to an image |
| `image_describe` | Natural-language description of an image |

## Requirements

| Requirement | Detail |
|---|---|
| Vision model | A multimodal model loaded in LM Studio, reachable at `baseUrl` (default `http://localhost:1234`) |

## Configuration

`baseUrl`, `apiKey`, `model`. Leave `model` empty to use whatever is loaded.

Configured in LM Studio under Integrations → analyze; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Sends image bytes to the configured endpoint. If `baseUrl` points off-box, images leave the machine. Reads any path it is given, subject to the process user's permissions.

## Failure modes

| Symptom | Cause |
|---|---|
| Empty or nonsense description | A text-only model is loaded — vision capability is required |
| 401 | LM Studio's API now requires a bearer token; set `apiKey` |

## Example prompts

- "What is in this screenshot?"
- "Classify this photo as indoor or outdoor."

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
