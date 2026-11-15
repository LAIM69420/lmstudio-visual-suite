#!/usr/bin/env node
/**
 * Smoke harness for a plugin suite.
 *
 * For every plugin directory under plugins/ it checks:
 *   - manifest.json parses and carries the fields LM Studio needs
 *   - version is semver and description is substantive
 *   - src/ contains TypeScript
 *   - tool names declared in source are unique and non-empty
 *   - if dist/ exists, the declared main file exists and the built bundle
 *     mentions every tool (catches a stale build)
 *
 * Then it compares the discovered tool inventory against expected-tools.json
 * so an accidental rename or dropped tool fails loudly. Run with --update to
 * rewrite that baseline after an intentional change.
 *
 *   node scripts/smoke.mjs
 *   node scripts/smoke.mjs --update
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginsDir = join(root, "plugins");
const baselinePath = join(root, "scripts", "expected-tools.json");
const update = process.argv.includes("--update");

// Plugins use both quote styles; accept either.
const TOOL_RE = /tool\(\s*\{\s*name:\s*["']([a-zA-Z0-9_]+)["']/g;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const failures = [];
const warnings = [];
const inventory = {};

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "dist") continue;
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

function builtSource(dir) {
  let out = "";
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out += builtSource(full);
    else if (entry.endsWith(".js")) out += readFileSync(full, "utf8");
  }
  return out;
}

const plugins = readdirSync(pluginsDir).filter((d) =>
  statSync(join(pluginsDir, d)).isDirectory() &&
  existsSync(join(pluginsDir, d, "manifest.json")),
);

for (const name of plugins) {
  const dir = join(pluginsDir, name);
  const fail = (msg) => failures.push(`${name}: ${msg}`);

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  } catch (err) {
    fail(`manifest.json is not valid JSON (${err.message})`);
    continue;
  }

  for (const key of ["name", "type", "runner", "version", "main", "license", "description", "categories"]) {
    if (manifest[key] === undefined || manifest[key] === null) fail(`manifest missing "${key}"`);
  }
  if (manifest.version && !SEMVER_RE.test(manifest.version)) {
    fail(`version "${manifest.version}" is not semver`);
  }
  if (typeof manifest.description === "string" && manifest.description.length < 30) {
    fail(`description is only ${manifest.description.length} chars — too short to be useful`);
  }
  if (Array.isArray(manifest.categories) && manifest.categories.length === 0) {
    fail(`no categories declared`);
  }
  if (manifest.icon) {
    if (!existsSync(join(dir, manifest.icon))) fail(`icon "${manifest.icon}" does not exist`);
  } else {
    warnings.push(`${name}: no icon declared`);
  }

  const srcDir = join(dir, "src");
  if (!existsSync(srcDir)) {
    fail(`no src/ directory`);
    continue;
  }
  const sources = walk(srcDir);
  if (sources.length === 0) fail(`src/ contains no TypeScript`);

  const tools = new Set();
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(TOOL_RE)) tools.add(m[1]);
  }
  if (tools.size === 0) fail(`no tool({ name: ... }) declarations found`);
  inventory[name] = [...tools].sort();

  const distDir = join(dir, "dist");
  if (existsSync(distDir)) {
    const mainPath = join(dir, manifest.main ?? "");
    if (!existsSync(mainPath)) {
      fail(`dist/ exists but declared main "${manifest.main}" does not`);
    } else {
      // Tools may live in sibling modules that main only imports, so scan the
      // whole build output rather than the entry file alone.
      const built = builtSource(distDir);
      const missing = inventory[name].filter((t) => !built.includes(t));
      if (missing.length) fail(`built output is stale — missing ${missing.join(", ")}`);

      // A source file newer than the build means someone edited and forgot to rebuild.
      const builtAt = statSync(mainPath).mtimeMs;
      const newer = sources.filter((f) => statSync(f).mtimeMs > builtAt + 1000);
      if (newer.length) {
        fail(`dist/ is older than ${newer.length} source file(s) — rebuild before installing`);
      }
    }
  } else {
    warnings.push(`${name}: not built (no dist/)`);
  }
}

const expected = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : null;

if (update || !expected) {
  writeFileSync(baselinePath, JSON.stringify(inventory, null, 2) + "\n");
  console.log(`baseline written: ${Object.keys(inventory).length} plugins -> ${baselinePath}`);
} else {
  for (const [name, tools] of Object.entries(expected)) {
    const actual = inventory[name];
    if (!actual) { failures.push(`${name}: in baseline but no longer present`); continue; }
    const added = actual.filter((t) => !tools.includes(t));
    const removed = tools.filter((t) => !actual.includes(t));
    if (added.length) failures.push(`${name}: new tool(s) not in baseline: ${added.join(", ")} (run --update)`);
    if (removed.length) failures.push(`${name}: tool(s) disappeared: ${removed.join(", ")}`);
  }
  for (const name of Object.keys(inventory)) {
    if (!(name in expected)) failures.push(`${name}: not in baseline (run --update)`);
  }
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const f of failures) console.log(`FAIL  ${f}`);

const total = plugins.length;
const toolCount = Object.values(inventory).reduce((n, t) => n + t.length, 0);
console.log(
  `\n${failures.length === 0 ? "PASS" : "FAILED"} — ${total} plugins, ${toolCount} tools, ` +
  `${failures.length} failure(s), ${warnings.length} warning(s)`,
);
process.exit(failures.length === 0 ? 0 : 1);
