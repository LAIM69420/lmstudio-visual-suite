import { createConfigSchematics } from "@lmstudio/sdk";
import * as os from "node:os";
import * as path from "node:path";

export function buildConfigSchematics() {
  return createConfigSchematics()
    .field("outputDir", "string", {}, path.join(os.homedir(), "Pictures", "lmstudio-screenshots"))
    .field("preferredTool", "string", {}, "auto")
    .build();
}
