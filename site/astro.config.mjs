import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import astroMermaid from "astro-mermaid";

export default defineConfig({
  site: "https://zircote.com",
  base: "/claude-team-orchestration",
  integrations: [
    astroMermaid(),
    starlight({
      title: "swarm",
      head: [
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content:
              "https://zircote.com/claude-team-orchestration/og-image.svg",
          },
        },
        {
          tag: "meta",
          attrs: { property: "og:image:width", content: "1280" },
        },
        {
          tag: "meta",
          attrs: { property: "og:image:height", content: "640" },
        },
        {
          tag: "meta",
          attrs: { name: "twitter:card", content: "summary_large_image" },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content:
              "https://zircote.com/claude-team-orchestration/og-image.svg",
          },
        },
      ],
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: true,
      },
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/zircote/claude-team-orchestration",
        },
      ],
      sidebar: [
        {
          label: "Overview",
          items: [
            { label: "Introduction", slug: "index" },
            { label: "Changelog", slug: "changelog" },
          ],
        },
        {
          label: "Getting Started",
          items: [
            {
              label: "Getting Started",
              slug: "getting-started/getting-started",
            },
          ],
        },
        {
          label: "How-To Guides",
          items: [
            {
              label: "Orchestration Patterns",
              slug: "how-to/patterns",
            },
            {
              label: "RLM Examples",
              slug: "how-to/rlm-examples",
            },
            {
              label: "RLM Prompt Example",
              slug: "how-to/rlm-prompt-example",
            },
            {
              label: "Troubleshooting",
              slug: "how-to/troubleshooting",
            },
          ],
        },
        {
          label: "Concepts",
          items: [
            {
              label: "Concepts",
              slug: "concepts/concepts",
            },
          ],
        },
        {
          label: "Reference",
          items: [
            {
              label: "Agent Types",
              slug: "reference/agent-types",
            },
            {
              label: "Reference",
              slug: "reference/reference",
            },
          ],
        },
        {
          label: "Skills Reference",
          items: [
            {
              label: "Orchestrating",
              slug: "skills/orchestrating",
            },
            {
              label: "Team Management",
              slug: "skills/team-management",
            },
            {
              label: "Task System",
              slug: "skills/task-system",
            },
            {
              label: "Messaging",
              slug: "skills/messaging",
            },
            {
              label: "Agent Types (Skill)",
              slug: "skills/agent-types",
            },
            {
              label: "Orchestration Patterns",
              slug: "skills/orchestration-patterns",
            },
            {
              label: "RLM Pattern",
              slug: "skills/rlm-pattern",
            },
            {
              label: "JSONL Log Analyzer",
              slug: "skills/jsonl-log-analyzer",
            },
            {
              label: "Spawn Backends",
              slug: "skills/spawn-backends",
            },
            {
              label: "Error Handling",
              slug: "skills/error-handling",
            },
            {
              label: "Complete Workflows",
              slug: "skills/complete-workflows",
            },
          ],
        },
        {
          label: "Design",
          items: [
            {
              label: "Content-Aware RLM",
              slug: "design/content-aware-rlm",
            },
            {
              label: "Multi-File RLM",
              slug: "design/multi-file-rlm",
            },
            {
              label: "Maker Consensus Pattern",
              slug: "design/maker-consensus-pattern",
            },
          ],
        },
      ],
    }),
  ],
});
