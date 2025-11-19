// src/typst-engine.ts
import { extname } from "jsr:@std/path@1.0.8";
var kMdExtensions = [".md", ".markdown"];
var kQmdExtensions = [".qmd"];
var quarto;
function chunkQuartoMarkdown(markdown) {
  const chunks = [];
  const metadataRegex = /^---\s*\n([\s\S]*?)\n---/;
  const metadataMatch = markdown.match(metadataRegex);
  let remainingMarkdown = markdown;
  if (metadataMatch) {
    chunks.push({
      type: "metadata",
      content: metadataMatch[1]
    });
    remainingMarkdown = remainingMarkdown.slice(metadataMatch[0].length);
  }
  const codeBlockRegex = /```\{([^}]*)\}([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = codeBlockRegex.exec(remainingMarkdown)) !== null) {
    const beforeText = remainingMarkdown.substring(lastIndex, match.index);
    if (beforeText.trim()) {
      chunks.push({
        type: "markdown",
        content: beforeText
      });
    }
    const language = match[1].trim();
    const codeContent = match[2].trim();
    chunks.push({
      type: "code",
      language,
      content: codeContent
    });
    lastIndex = match.index + match[0].length;
  }
  const afterText = remainingMarkdown.substring(lastIndex);
  if (afterText.trim()) {
    chunks.push({
      type: "markdown",
      content: afterText
    });
  }
  return chunks;
}
function quartoChunksToMarkdown(chunks) {
  let result = "";
  for (const chunk of chunks) {
    switch (chunk.type) {
      case "metadata":
        result += `---
${chunk.content}
---

`;
        break;
      case "markdown":
        result += `\`\`\`{=typst}
${chunk.content}
\`\`\`

`;
        break;
      case "code":
        result += `\`\`\`{${chunk.language}}
${chunk.content}
\`\`\`

`;
        break;
    }
  }
  return result;
}
var typstEngineDiscovery = {
  init: (quartoAPI) => {
    quarto = quartoAPI;
  },
  // Basic engine properties
  name: "typst",
  defaultExt: ".qmd",
  defaultYaml: () => [],
  defaultContent: () => [],
  validExtensions: () => kQmdExtensions.concat(kMdExtensions),
  claimsFile: (_file, ext) => {
    return kMdExtensions.includes(ext.toLowerCase());
  },
  claimsLanguage: (_language) => {
    return false;
  },
  canFreeze: false,
  generatesFigures: false,
  /**
   * Launch a dynamic execution engine with project context
   */
  launch: (context) => {
    return {
      // Properties needed on both interfaces
      name: typstEngineDiscovery.name,
      canFreeze: typstEngineDiscovery.canFreeze,
      /**
       * Read file and convert to markdown with source mapping
       */
      markdownForFile(file) {
        return Promise.resolve(quarto.mappedString.fromFile(file));
      },
      /**
       * Create an execution target for a file
       */
      target: (file, _quiet, markdown) => {
        const md = markdown ?? quarto.mappedString.fromFile(file);
        const metadata = quarto.markdownRegex.extractYaml(md.value);
        const target = {
          source: file,
          input: file,
          markdown: md,
          metadata
        };
        return Promise.resolve(target);
      },
      /**
       * Extract partitioned markdown from a file
       */
      partitionedMarkdown: (file) => {
        return Promise.resolve(
          quarto.markdownRegex.partition(Deno.readTextFileSync(file))
        );
      },
      /**
       * Execute a document - this is where the Typst transformation happens!
       */
      execute: (options) => {
        let markdown = options.target.markdown.value;
        const chunks = chunkQuartoMarkdown(markdown);
        if (extname(options.target.input).toLowerCase() === ".md") {
          const codeChunks = chunks.filter((chunk) => chunk.type === "code");
          if (codeChunks.length > 0) {
            throw new Error(
              "You must use the .qmd extension for documents with executable code."
            );
          }
        }
        markdown = quartoChunksToMarkdown(chunks);
        return Promise.resolve({
          engine: "typst",
          markdown,
          supporting: [],
          filters: []
        });
      },
      /**
       * Process dependencies
       */
      dependencies: (_options) => {
        return Promise.resolve({
          includes: {}
        });
      },
      /**
       * Post-process output
       */
      postprocess: (_options) => Promise.resolve()
    };
  }
};
var typst_engine_default = typstEngineDiscovery;
export {
  typst_engine_default as default,
  kMdExtensions,
  kQmdExtensions
};
