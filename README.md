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

## Setup

This engine requires Quarto 1.9 (currently in development).

For development:

1. Place this directory adjacent to the `quarto-cli` directory, maintaining the relative paths.
2. Ensure the `@quarto/types` package is built:

```bash
cd ../quarto-cli/packages/quarto-types
npm install
npm run build
````

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

The extension is structured as follows:

```
_extensions/
  └── typst-engine/
      ├── _extension.yml      # Extension metadata
      └── typst-engine.ts     # Engine implementation
```

### The \_discovery Flag

This engine implements the new `ExecutionEngineDiscovery` interface with a `_discovery` flag:

```typescript
const typstEngineDiscovery: ExecutionEngineDiscovery & { _discovery: boolean } =
  {
    _discovery: true,
    // ...
  };
```

This is a temporary flag that indicates the engine supports the new Quarto 1.9 ExecutionEngineDiscovery interface. This flag likely won't be needed when version 1.9 becomes the stable release.

### @quarto/types Package

**Important**: This engine imports types from the `@quarto/types` package using a relative path to the built distribution:

```typescript
import {
  ExecutionEngineDiscovery,
  // Other types...
} from "../../../quarto-cli/packages/quarto-types/dist/index.js";
```

The `@quarto/types` package must be built before using this engine. See [Setup](#setup).

Note that `@quarto/types` is not yet published as an npm package because its API is still in flux. Using it directly like this is experimental and may break with future Quarto updates. Use at your own risk.
