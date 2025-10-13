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

initParser();

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

    console.log("md", (markdown));

    // if it's plain md, validate that it doesn't have executable cells in it
    if (extname(options.target.input).toLowerCase() === ".md") {
      const languages = languagesInMarkdown(markdown);
      if (languages.size > 0) {
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
