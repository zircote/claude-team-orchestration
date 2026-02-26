#!/usr/bin/env node

/**
 * Generates Starlight MDX pages from source markdown docs.
 * Reads docs-mapping.json for source-to-output mapping.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..", "..");
const siteRoot = resolve(__dirname, "..");

/**
 * Build a unified link map keyed by project-root-relative normalized path.
 * Covers docs→docs, docs→skills, and external links.
 */
function buildLinkMap(mappingPages) {
  const linkMap = {};

  // Map each source file to its output URL
  for (const page of mappingPages) {
    const normalized = normalize(page.source);
    const url = "/" + page.output.replace(/\.mdx$/, "/");
    linkMap[normalized] = url;
  }

  // Skills mappings (for cross-references from docs to skills)
  const skillDirs = [
    "orchestrating",
    "team-management",
    "task-system",
    "messaging",
    "agent-types",
    "orchestration-patterns",
    "rlm-pattern",
    "spawn-backends",
    "error-handling",
    "jsonl-log-analyzer",
  ];
  for (const skill of skillDirs) {
    linkMap[normalize(`skills/${skill}/SKILL.md`)] = `/skills/${skill}/`;
  }

  // Complete workflows (lives under orchestration-patterns/examples/)
  linkMap[
    normalize("skills/orchestration-patterns/examples/complete-workflows.md")
  ] = "/skills/complete-workflows/";

  // External links for files not included in the site
  linkMap["README.md"] =
    "https://github.com/zircote/claude-team-orchestration/blob/main/README.md";

  return linkMap;
}

/**
 * Rewrite relative markdown links to Starlight URLs.
 * Resolves relative paths against the source file's directory,
 * normalizes to project-root-relative, and looks up in the link map.
 */
function rewriteLinks(content, linkMap, sourceFile) {
  const sourceDir = dirname(sourceFile);

  return content.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match, text, href) => {
    // Skip external links, anchors, and images
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("#") ||
      href.startsWith("mailto:")
    ) {
      return match;
    }

    // Split off anchor
    const [pathPart, anchor] = href.split("#");
    if (!pathPart) {
      // Pure anchor link
      return match;
    }

    // Resolve relative to source file directory, then normalize to project-root-relative
    const resolved = normalize(join(sourceDir, pathPart));

    if (linkMap[resolved]) {
      const suffix = anchor ? `#${anchor}` : "";
      return `[${text}](${linkMap[resolved]}${suffix})`;
    }

    // Try just the filename as fallback
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

function stripFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, "");
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function buildFrontmatter(page, extractedTitle) {
  const title = page.title || extractedTitle || "Untitled";
  const lines = ["---"];
  lines.push(`title: "${title}"`);
  if (page.description) {
    lines.push(`description: "${page.description}"`);
  }
  if (page.sidebarLabel && page.sidebarLabel !== title) {
    lines.push(`sidebar:`);
    lines.push(`  label: "${page.sidebarLabel}"`);
  }
  lines.push("---");
  return lines.join("\n");
}

/**
 * Escape MDX-invalid constructs: curly braces outside code blocks/inline code.
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

    // Escape {, }, and bare < outside inline code
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
        // Escape < when not followed by a letter, / or ! (not an HTML tag)
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
        // Escape > when not closing an HTML tag
        escaped += "&gt;";
      } else {
        escaped += ch;
      }
    }
    result.push(escaped);
  }

  return result.join("\n");
}

/**
 * Generate docs pages, optionally to a custom output directory.
 * @param {string} [outputBase] - Override output base directory (for freshness checks)
 * @returns {{ generated: string[], skipped: string[] }}
 */
export function generateDocsPages(outputBase) {
  const mapping = JSON.parse(
    readFileSync(join(__dirname, "docs-mapping.json"), "utf-8"),
  );
  const linkMap = buildLinkMap(mapping.pages);
  const outDir = outputBase || join(siteRoot, mapping.outputDir);
  const generated = [];
  const skipped = [];

  for (const page of mapping.pages) {
    const sourcePath = join(projectRoot, page.source);
    if (!existsSync(sourcePath)) {
      console.warn(`  SKIP: ${page.source} (not found)`);
      skipped.push(page.source);
      continue;
    }

    const raw = readFileSync(sourcePath, "utf-8");
    const stripped = stripFrontmatter(raw);
    const extractedTitle = extractTitle(stripped);
    const frontmatter = buildFrontmatter(page, extractedTitle);

    // Strip HTML comments (invalid in MDX)
    let body = stripped.replace(/<!--[\s\S]*?-->/g, "");

    // Rewrite markdown links
    body = rewriteLinks(body, linkMap, page.source);

    // Strip H1 (title comes from frontmatter)
    const h1Match = body.match(/^#\s+.+\n+/);
    if (h1Match) {
      body = body.slice(h1Match[0].length);
    }

    // Escape MDX-invalid constructs
    body = escapeMdx(body);

    const content = `${frontmatter}\n\n${body.trim()}\n`;
    const outPath = join(outDir, page.output);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content, "utf-8");
    console.log(`  OK: ${page.output}`);
    generated.push(page.output);
  }

  return { generated, skipped };
}

// Run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("Generating docs pages...");
  const { generated, skipped } = generateDocsPages();
  console.log(
    `\nDone: ${generated.length} generated, ${skipped.length} skipped.`,
  );
}
