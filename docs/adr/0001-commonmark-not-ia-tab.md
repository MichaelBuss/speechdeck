# CommonMark source, not iA's tab

iA Presenter promotes a paragraph onto the slide with a leading tab. A tab (or four spaces) is an indented code block in CommonMark, so that file is not a talk manuscript on GitHub, and Prettier will fight it. The **Deck** is CommonMark plus YAML **Frontmatter**: **Promotion** is `<!--on-->`, **Comments** are HTML comments, a `---` is the only **Slide** break. MDX and TypeScript-as-the-document were rejected — the parse result is TypeScript, the talk is Markdown.
