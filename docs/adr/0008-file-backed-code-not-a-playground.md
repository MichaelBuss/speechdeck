# File-backed code cells, not a live playground

A code **Cell**'s bytes are the fence body or a path relative to the **Deck** — the whole file, or a named **Region**. An **Embed** at that same path runs the file, so the highlighted code and the running guest cannot drift. Inline fences stay for everything else. Live-edit on the **Slide** (Monaco, eval) is out of v0: the presenter edits in Cursor; `vite dev` HMR updates both. A **Region** is `#region name` … `#endregion`, not a line range and not an AST extract. Code paths are not package names or URLs — those are something you run.

Rejected: a `LivePair` node; Slidev `<<<`; body-as-specifier with a `file` flag; highlighting `@scope/pkg` dist.
