#!/usr/bin/env node

/**
 * Orchestrates all content generators.
 */

import { generateDocsPages } from "./generate-docs-pages.mjs";
import { generateSkillsPages } from "./generate-skills-pages.mjs";

console.log("=== Generating documentation site content ===\n");

console.log("[1/2] Docs pages:");
const docs = generateDocsPages();

console.log("\n[2/2] Skills pages:");
const skills = generateSkillsPages();

const totalGenerated = docs.generated.length + skills.generated.length;
const totalSkipped = docs.skipped.length + skills.skipped.length;

console.log(
  `\n=== Done: ${totalGenerated} generated, ${totalSkipped} skipped ===`,
);

if (totalSkipped > 0) {
  process.exit(1);
}
