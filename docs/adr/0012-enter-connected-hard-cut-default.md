# Opt-in `enter: connected`, hard cut by default

A pair of **Slides** is a **hard cut** unless the arriving **Slide** opts in with `enter: connected`. Default `cut` is omitted. Connection is not a glossary noun.

iA's implicit-until-cut needs an editor gutter; this is a file in a repo, and accidental identity matches would morph. A second prose marker was rejected: CommonMark already conflates `---` / `***` / `___`, and **Frontmatter** is the shelf for facts that aren't in the document. `cut: connected` was the prototype field and an oxymoron; `connected: true` is a boolean in a trench coat.

`enter: connected` names the document-order edge from the previous **Slide**. Sequential next and back run connected motion; first paint, deep links, and skips that jump a **Slide** hard-cut even when the destination says `connected`. Travel *t* is unchanged (ADR 0004).
