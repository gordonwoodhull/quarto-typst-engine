/*
 * typst-engine.ts
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

// Import types from built distribution
import {
  DependenciesOptions,
  DependenciesResult,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngineDiscovery,
  ExecutionTarget,
  LaunchedExecutionEngine,
  PostProcessOptions,
  PartitionedMarkdown,
  MappedString,
  EngineProjectContext,
  QuartoAPI
} from "../../../quarto-cli/packages/quarto-types/dist/index.js";

// Import from Deno standard library
import { extname } from "path";

export const kMdExtensions = [".md", ".markdown"];
export const kQmdExtensions = [".qmd"];


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

/**
 * Converts an array of Quarto chunks back into a Quarto markdown string.
 * Markdown chunks are wrapped in ```{=typst} ... ``` delimiters.
 *
 * @param chunks Array of Quarto chunks to convert
 * @returns The combined Quarto markdown string
 */
function quartoChunksToMarkdown(chunks: QuartoChunk[]): string {
  let result = '';

  for (const chunk of chunks) {
    switch (chunk.type) {
      case 'metadata':
        // Metadata is wrapped in triple dashes
        result += `---\n${chunk.content}\n---\n\n`;
        break;

      case 'markdown':
        // Markdown chunks are wrapped in ```{=typst} ... ``` delimiters
        result += `\`\`\`{=typst}\n${chunk.content}\n\`\`\`\n\n`;
        break;

      case 'code':
        // Code blocks are wrapped in triple backticks with language spec
        result += `\`\`\`{${chunk.language}}\n${chunk.content}\n\`\`\`\n\n`;
        break;
    }
  }

  return result;
}



/**
 * Typst engine discovery implementation
 * This uses the new ExecutionEngineDiscovery interface with _discovery flag
 */
const typstEngineDiscovery: ExecutionEngineDiscovery & { _discovery: boolean } = {
  // Flag to indicate this is a discovery engine (will be removed in stable 1.9)
  _discovery: true,

  // Basic engine properties
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
  canFreeze: false,
  generatesFigures: false,

  /**
   * Launch a dynamic execution engine with project context
   */
  launch: (context: EngineProjectContext): LaunchedExecutionEngine => {
    return {
      // Properties needed on both interfaces
      name: typstEngineDiscovery.name,
      canFreeze: typstEngineDiscovery.canFreeze,

      /**
       * Read file and convert to markdown with source mapping
       */
      markdownForFile(file: string): Promise<MappedString> {
        return Promise.resolve(context.quarto.mappedString.fromFile(file));
      },

      /**
       * Create an execution target for a file
       */
      target: (file: string, _quiet?: boolean, markdown?: MappedString) => {
        if (markdown === undefined) {
          markdown = context.quarto.mappedString.fromFile(file);
        }
        const metadata = context.quarto.markdownRegex.extractYaml(markdown.value);
        const target: ExecutionTarget = {
          source: file,
          input: file,
          markdown,
          metadata,
        };
        return Promise.resolve(target);
      },

      /**
       * Extract partitioned markdown from a file
       */
      partitionedMarkdown: (file: string) => {
        return Promise.resolve(
          context.quarto.markdownRegex.partition(Deno.readTextFileSync(file)),
        );
      },

      /**
       * Execute a document - this is where the Typst transformation happens!
       */
      execute: (options: ExecuteOptions): Promise<ExecuteResult> => {
        // read markdown
        let markdown = options.target.markdown.value;

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

        markdown = quartoChunksToMarkdown(chunks);

        return Promise.resolve({
          engine: "typst",
          markdown,
          supporting: [],
          filters: [],
        });
      },

      /**
       * Process dependencies
       */
      dependencies: (_options: DependenciesOptions): Promise<DependenciesResult> => {
        return Promise.resolve({
          includes: {},
        });
      },

      /**
       * Post-process output
       */
      postprocess: (_options: PostProcessOptions): Promise<void> => Promise.resolve(),
    };
  }
};

export default typstEngineDiscovery;