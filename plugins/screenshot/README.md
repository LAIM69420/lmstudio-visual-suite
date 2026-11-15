# screenshot

Captures the full screen, the active window, or a region, saving PNG files.

| | |
|---|---|
| Type | tools |
| Tools | 2 |
| Requires network | no |
| Requires external service | no |
| Destructive | yes |
| Version | 1.0.0 |

## Tools

| Tool | What it does |
|---|---|
| `screenshot` | Capture screen, window, or region |
| `screenshot_displays` | List connected displays and their geometry |

## Requirements

| Requirement | Detail |
|---|---|
| Display server | X11 or Wayland session; headless hosts fail |

## Configuration

`outputDir`, `preferredTool` (`auto`/`grim`/`scrot`/`import`/...).

Configured in LM Studio under Integrations → screenshot; field definitions live in `src/configSchematics.ts`.

## Privileged surface

**Captures whatever is on screen.** That includes other applications, notifications, and private messages, and the file is written in plaintext to `outputDir`. On a shared or remote display this is a privacy problem, not a convenience.

## Failure modes

| Symptom | Cause |
|---|---|
| Black image on Wayland | Portal permission denied — prefer `grim` |
| No displays listed | No graphical session reachable from the plugin process |

## Example prompts

- "Screenshot my main display."
- "Capture the active window and describe it."

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
