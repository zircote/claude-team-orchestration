#!/usr/bin/env node

/**
 * Generates Starlight MDX pages from skills SKILL.md files.
 * Strips YAML frontmatter and uses name/description for Starlight frontmatter.
 * Also handles complete-workflows.md from orchestration-patterns/examples/.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..", "..");
const siteRoot = resolve(__dirname, "..");

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Returns { name, description, body } where body is the content after frontmatter.
 */
function parseSkillFrontmatter(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return { name: null, description: null, body: content };
  }

  const yaml = fmMatch[1];
  const body = fmMatch[2];

  // Simple YAML extraction for name and description
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  const descMatch = yaml.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, "") : null,
    description: descMatch
      ? descMatch[1].trim().replace(/^["']|["']$/g, "")
      : null,
    body,
  };
}

/**
 * Build link map for skills cross-references.
 */
function buildLinkMap() {
  const linkMap = {};

  // Skills → skills
  const skillDirs = readdirSync(join(projectRoot, "skills")).filter((d) => {
    const fullPath = join(projectRoot, "skills", d);
    return (
      statSync(fullPath).isDirectory() && existsSync(join(fullPath, "SKILL.md"))
    );
  });

  for (const skill of skillDirs) {
    linkMap[normalize(`skills/${skill}/SKILL.md`)] = `/skills/${skill}/`;
  }

  // Complete workflows
  linkMap[
    normalize("skills/orchestration-patterns/examples/complete-workflows.md")
  ] = "/skills/complete-workflows/";

  // Docs mapping (for skills → docs cross-references)
  const mapping = JSON.parse(
    readFileSync(join(__dirname, "docs-mapping.json"), "utf-8"),
  );
  for (const page of mapping.pages) {
    linkMap[normalize(page.source)] = "/" + page.output.replace(/\.mdx$/, "/");
  }

  linkMap["README.md"] =
    "https://github.com/zircote/claude-team-orchestration/blob/main/README.md";

  return linkMap;
}

/**
 * Rewrite relative links, resolving against source file directory.
 */
function rewriteLinks(content, linkMap, sourceFile) {
  const sourceDir = dirname(sourceFile);

  return content.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match, text, href) => {
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("#") ||
      href.startsWith("mailto:")
    ) {
      return match;
    }

    const [pathPart, anchor] = href.split("#");
    if (!pathPart) return match;

    const resolved = normalize(join(sourceDir, pathPart));

    if (linkMap[resolved]) {
      const suffix = anchor ? `#${anchor}` : "";
      return `[${text}](${linkMap[resolved]}${suffix})`;
    }

    // Filename fallback
    const filename = pathPart.split("/").pop();
    for (const [key, url] of Object.entries(linkMap)) {
      if (key.endsWith(filename)) {
        const suffix = anchor ? `#${anchor}` : "";
        return `[${text}](${url}${suffix})`;
      }
    }

    return match;
  });
}

/**
 * Escape MDX-invalid constructs outside code blocks/inline code.
 */
function escapeMdx(content) {
  const lines = content.split("\n");
  let inCodeBlock = false;
  const result = [];

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    let escaped = "";
    let inInlineCode = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "`") {
        inInlineCode = !inInlineCode;
        escaped += ch;
      } else if (!inInlineCode && (ch === "{" || ch === "}")) {
        escaped += ch === "{" ? "\\{" : "\\}";
      } else if (!inInlineCode && ch === "<") {
        const next = line[i + 1];
        if (next && /[a-zA-Z/!]/.test(next)) {
          escaped += ch;
        } else {
          escaped += "&lt;";
        }
      } else if (
        !inInlineCode &&
        ch === ">" &&
        i > 0 &&
        !/[a-zA-Z"'/\-\d]/.test(line[i - 1])
      ) {
        escaped += "&gt;";
      } else {
        escaped += ch;
      }
    }
    result.push(escaped);
  }

  return result.join("\n");
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Human-readable title from a skill directory name.
 */
function humanize(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Generate skills pages, optionally to a custom output directory.
 * @param {string} [outputBase] - Override output base directory (for freshness checks)
 * @returns {{ generated: string[], skipped: string[] }}
 */
export function generateSkillsPages(outputBase) {
  const linkMap = buildLinkMap();
  const outDir = outputBase || join(siteRoot, "src/content/docs");
  const generated = [];
  const skipped = [];

  // Find all skill directories
  const skillsDir = join(projectRoot, "skills");
  const skillDirs = readdirSync(skillsDir).filter((d) => {
    const fullPath = join(skillsDir, d);
    return (
      statSync(fullPath).isDirectory() && existsSync(join(fullPath, "SKILL.md"))
    );
  });

  for (const skill of skillDirs) {
    const sourcePath = join(skillsDir, skill, "SKILL.md");
    const sourceRelative = `skills/${skill}/SKILL.md`;
    const raw = readFileSync(sourcePath, "utf-8");
    const { name, description, body } = parseSkillFrontmatter(raw);

    const title = name ? humanize(name) : humanize(skill);
    const lines = ["---"];
    lines.push(`title: "${title}"`);
    if (description) {
      // Escape quotes in description
      lines.push(`description: "${description.replace(/"/g, '\\"')}"`);
    }
    lines.push("---");
    const frontmatter = lines.join("\n");

    // Strip H1 if present
    let content = body;
    const h1Match = content.match(/^#\s+.+\n+/);
    if (h1Match) {
      content = content.slice(h1Match[0].length);
    }

    // Strip HTML comments
    content = content.replace(/<!--[\s\S]*?-->/g, "");

    // Rewrite links
    content = rewriteLinks(content, linkMap, sourceRelative);

    // Escape MDX constructs
    content = escapeMdx(content);

    const output = `skills/${skill}.mdx`;
    const outPath = join(outDir, output);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${frontmatter}\n\n${content.trim()}\n`, "utf-8");
    console.log(`  OK: ${output}`);
    generated.push(output);
  }

  // Handle complete-workflows.md (no YAML frontmatter)
  const cwPath = join(
    skillsDir,
    "orchestration-patterns",
    "examples",
    "complete-workflows.md",
  );
  if (existsSync(cwPath)) {
    const raw = readFileSync(cwPath, "utf-8");
    const extractedTitle = extractTitle(raw) || "Complete Workflows";

    const frontmatter = [
      "---",
      `title: "${extractedTitle}"`,
      `description: "End-to-end orchestration workflow examples."`,
      "---",
    ].join("\n");

    let content = raw;
    const h1Match = content.match(/^#\s+.+\n+/);
    if (h1Match) {
      content = content.slice(h1Match[0].length);
    }

    content = content.replace(/<!--[\s\S]*?-->/g, "");
    content = rewriteLinks(
      content,
      linkMap,
      "skills/orchestration-patterns/examples/complete-workflows.md",
    );
    content = escapeMdx(content);

    const output = "skills/complete-workflows.mdx";
    const outPath = join(outDir, output);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${frontmatter}\n\n${content.trim()}\n`, "utf-8");
    console.log(`  OK: ${output}`);
    generated.push(output);
  } else {
    console.warn(
      "  SKIP: skills/orchestration-patterns/examples/complete-workflows.md (not found)",
    );
    skipped.push(
      "skills/orchestration-patterns/examples/complete-workflows.md",
    );
  }

  return { generated, skipped };
}

// Run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("Generating skills pages...");
  const { generated, skipped } = generateSkillsPages();
  console.log(
    `\nDone: ${generated.length} generated, ${skipped.length} skipped.`,
  );
}
