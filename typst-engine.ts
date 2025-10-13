/*
 * typst-engine.ts
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

// quarto types are not published, so we assume the source is next door

import { extname } from "../quarto-cli/src/deno_ral/path.ts";

import { readYamlFromMarkdown } from "../quarto-cli/src/core/yaml.ts";
import { partitionMarkdown } from "../quarto-cli/src/core/pandoc/pandoc-partition.ts";

import {
  DependenciesOptions,
  ExecuteOptions,
  ExecutionEngine,
  ExecutionTarget,
  kMarkdownEngine,
  kQmdExtensions,
  PostProcessOptions,
} from "../quarto-cli/src/execute/types.ts";
import { languagesInMarkdown } from "../quarto-cli/src/execute/engine-shared.ts";
import { mappedStringFromFile } from "../quarto-cli/src/core/mapped-text.ts";
import { MappedString } from "../quarto-cli/src/core/lib/text-types.ts";
import { default as initParser, parse_qmd } from "./wasm-qmd-parser/wasm_qmd_parser.js"
export const kMdExtensions = [".md", ".markdown"];


/**
 * Types of chunks in a Quarto document
 */
type QuartoChunkType = 'metadata' | 'markdown' | 'code';

/**
 * Base interface for Quarto document chunks
 */
interface QuartoChunkBase {
  type: QuartoChunkType;
  content: string;
}

/**
 * Metadata chunk (YAML frontmatter)
 */
interface MetadataChunk extends QuartoChunkBase {
  type: 'metadata';
}

/**
 * Regular markdown chunk
 */
interface MarkdownChunk extends QuartoChunkBase {
  type: 'markdown';
}

/**
 * Code block chunk
 */
interface CodeChunk extends QuartoChunkBase {
  type: 'code';
  language: string;
}

/**
 * Union type for all possible chunk types
 */
type QuartoChunk = MetadataChunk | MarkdownChunk | CodeChunk;

/**
 * Parses a Quarto markdown document into a sequence of chunks, preserving the original order.
 *
 * @param markdown The Quarto markdown content to parse
 * @returns An array of chunks (metadata, markdown, code) in their original sequence
 */
function chunkQuartoMarkdown(markdown: string): QuartoChunk[] {
  const chunks: QuartoChunk[] = [];

  // Extract metadata (YAML frontmatter) if present
  const metadataRegex = /^---\s*\n([\s\S]*?)\n---/;
  const metadataMatch = markdown.match(metadataRegex);

  let remainingMarkdown = markdown;

  if (metadataMatch) {
    chunks.push({
      type: 'metadata',
      content: metadataMatch[1]
    });

    // Remove the metadata from the markdown for further processing
    remainingMarkdown = remainingMarkdown.slice(metadataMatch[0].length);
  }

  // Process the remaining content to extract code blocks and markdown
  // This regex matches code blocks like ```{mermaid} ... ```
  const codeBlockRegex = /```\{([^}]*)\}([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(remainingMarkdown)) !== null) {
    // Text before this code block is markdown
    const beforeText = remainingMarkdown.substring(lastIndex, match.index);
    if (beforeText.trim()) {
      chunks.push({
        type: 'markdown',
        content: beforeText
      });
    }

    // Extract language and code content
    const language = match[1].trim();
    const codeContent = match[2].trim();

    chunks.push({
      type: 'code',
      language,
      content: codeContent
    });

    // Update the last position
    lastIndex = match.index + match[0].length;
  }

  // Add any remaining markdown after the last code block
  const afterText = remainingMarkdown.substring(lastIndex);
  if (afterText.trim()) {
    chunks.push({
      type: 'markdown',
      content: afterText
    });
  }

  return chunks;
}



const typstEngine: ExecutionEngine = {
  name: "typst",

  defaultExt: ".qmd",

  defaultYaml: () => [],

  defaultContent: () => [],

  validExtensions: () => kQmdExtensions.concat(kMdExtensions),

  claimsFile: (_file: string, ext: string) => {
    return kMdExtensions.includes(ext.toLowerCase());
  },
  claimsLanguage: (_language: string) => {
    return false;
  },
  markdownForFile(file: string): Promise<MappedString> {
    return Promise.resolve(mappedStringFromFile(file));
  },

  target: (file: string, _quiet?: boolean, markdown?: MappedString) => {
    if (markdown === undefined) {
      markdown = mappedStringFromFile(file);
    }
    const metadata = readYamlFromMarkdown(markdown.value);
    const target: ExecutionTarget = {
      source: file,
      input: file,
      markdown,
      metadata,
    };
    return Promise.resolve(target);
  },

  partitionedMarkdown: (file: string) => {
    return Promise.resolve(partitionMarkdown(Deno.readTextFileSync(file)));
  },

  execute: (options: ExecuteOptions) => {
    // read markdown
    const markdown = options.target.markdown.value;

    // Parse the markdown into chunks
    const chunks = chunkQuartoMarkdown(markdown);
    console.log("Parsed chunks:", chunks);

    // if it's plain md, validate that it doesn't have executable cells in it
    if (extname(options.target.input).toLowerCase() === ".md") {
      // Check for code blocks in the parsed chunks
      const codeChunks = chunks.filter(chunk => chunk.type === 'code');
      if (codeChunks.length > 0) {
        throw new Error(
          "You must use the .qmd extension for documents with executable code.",
        );
      }
    }

    return Promise.resolve({
      engine: "typst",
      markdown,
      supporting: [],
      filters: [],
    });
  },
  dependencies: (_options: DependenciesOptions) => {
    return Promise.resolve({
      includes: {},
    });
  },
  postprocess: (_options: PostProcessOptions) => Promise.resolve(),

  canFreeze: false,
  generatesFigures: false,
};

export default typstEngine;
