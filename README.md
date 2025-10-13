# experimental typst engine for Quarto

This is a test of a Quarto external engine, a feature which may arrive in Quarto 1.9. 

This engine is an experiment in using Typst as the main markdown language in a Quarto document.

Code blocks are passed through; the surrounding markdown is wrapped in 

````
```{=typst}
...
```
````

This is probably not robust enough an approach, and shuts out other Quarto features since there is no good way to escape back to Quarto markdown.

Just an experiment to see what such a language would look like.

## Setup

This is only a proof of concept and probably not the way external engines will work. In particular, Quarto is not currently available as a package so this needs to access Quarto source files locally.

For this reason, put this directory adjacent to `quarto-cli`, e.g. I have `~/src/quarto-cli` and `~/src/quarto-typst-engine`.

Then, to enable the typst engine in your quarto project, use the `feature/external-engines` branch of Quarto and add

```yaml
engines:
  - url: "../../../quarto-typst-engine/typst-engine.ts"
```

to your `_quarto.yml`, and set

```yaml
format: typst
engine: typst
```

in your document.
