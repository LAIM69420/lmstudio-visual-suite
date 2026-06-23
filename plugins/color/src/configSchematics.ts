import { createConfigSchematics } from "@lmstudio/sdk";

export function buildConfigSchematics() {
  return createConfigSchematics()
    .field("defaultPaletteSize", "numeric", { min: 2, max: 10, int: true }, 5)
    .build();
}
