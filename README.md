# Experimental Typst Engine for Quarto

A demonstration of a Quarto engine extension that enables using Typst syntax directly in Quarto documents. This project has been updated to use the new `ExecutionEngineDiscovery` interface coming in Quarto 1.9.

This is just an experiment and not for production use!

## How it Works

This engine is an experiment in using Typst as the main markdown language in a Quarto document. It works by:

1. Chunking your document into metadata, markdown, and code blocks
2. Wrapping regular markdown content in `{=typst}` raw blocks:

````
```{=typst}
Your regular markdown content
````

````

3. Preserving code blocks (like `{mermaid}` or `{dot}`) to be processed by their respective engines

This allows you to use Typst's powerful typesetting features directly in your Quarto document, while still having access to Quarto's code execution features.

## Limitations

This is primarily an experimental approach with some limitations:

- No good way to escape back to Quarto markdown once in Typst mode
- Many Quarto features might not be accessible when using Typst syntax
- The parser might not handle all edge cases correctly

## Installation

This extension can be installed directly from GitHub:

```bash
quarto install extension gordonwoodhull/quarto-typst-engine
```

This will install the extension in your project's `_extensions/` directory.

## Development

This extension is written in TypeScript and requires Quarto 1.9 (currently in development).

The TypeScript source is in `src/typst-engine.ts`. To build the extension:

```bash
quarto dev-call build-ts-extension
```

This will:
- Type-check the TypeScript code against Quarto's API types
- Bundle the extension into `_extensions/typst-engine/typst-engine.js`

The built JavaScript file should be committed to version control.

## Usage

In any Quarto document, set both the format and engine to typst:

```yaml
---
title: "My Document"
format: typst
engine: typst
---
```

You can then use Typst syntax directly in your document, as shown in the `columns-typst.qmd` example.

## Technical Notes

### Extension Structure

The extension follows the standard Quarto engine extension structure:

```
├── src/
│   └── typst-engine.ts         # TypeScript source
└── _extensions/
    └── typst-engine/
        ├── _extension.yml      # Extension metadata
        └── typst-engine.js     # Built JavaScript (bundled)
```

### Type System

This engine uses Quarto's type definitions via the `@quarto/types` import map:

```typescript
import type {
  ExecutionEngineDiscovery,
  QuartoAPI,
  // Other types...
} from "@quarto/types";
```

The types are provided by Quarto during type-checking and are erased during bundling (type-only imports).

### External Dependencies

External dependencies like Deno standard library modules are imported using full JSR URLs:

```typescript
import { extname } from "jsr:@std/path@1.0.8";
```

These imports are marked as external during bundling and resolved by Quarto's Deno runtime at load time.
