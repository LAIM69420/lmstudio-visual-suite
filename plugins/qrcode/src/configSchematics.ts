import { createConfigSchematics } from "@lmstudio/sdk";

export function buildConfigSchematics() {
  return createConfigSchematics()
    .field("moduleSize", "numeric", { min: 4, max: 20, int: true }, 8)
    .field("quietZone", "numeric", { min: 0, max: 8, int: true }, 4)
    .build();
}
