# generate

Generates images from a prompt via local Stable Diffusion, Replicate, or OpenAI/DALL-E.

| | |
|---|---|
| Type | tools |
| Tools | 1 |
| Requires network | no |
| Requires external service | yes |
| Destructive | yes |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `image_generate` | Generate an image from a text prompt and save it to disk |

## Requirements

| Requirement | Detail |
|---|---|
| Provider | One of: local SD web UI on `127.0.0.1:7860`, a Replicate token, an OpenAI key |

## Configuration

`provider` (`auto`/`local`/`replicate`/`openai`), `baseUrl`, `apiKey`, `defaultModel`, `outputDir`.

Configured in LM Studio under Integrations → generate; field definitions live in `src/configSchematics.ts`.

## Privileged surface

Writes image files to `outputDir` (default `~/Pictures/generated`) and sends prompts to whichever provider is configured. With a cloud provider, prompts and API keys leave the machine; keys are stored in plugin config marked `isProtected`.

## Failure modes

| Symptom | Cause |
|---|---|
| Connection refused on :7860 | Local SD web UI not running, or launched without `--api` |
| 401/403 | Cloud provider key missing or wrong for the selected `provider` |

## Example prompts

- "Generate a wide shot of a foggy harbour at dawn."
- "Make a 1:1 icon of a brass gear on black."

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
