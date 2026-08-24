# Build-time Shiki, View Transitions for code morph

v0 highlights with Shiki at build (CSS-variables theme, spans on every code block) and morphs matching regions with the same-document View Transition the router already runs. Microlighter is out once morph is in: a span inside `<code>` makes it skip the block. Magic Move's FLIP renderer is a second animation runtime and is out; only its diff (`@shikijs/magic-move/core`) is used, inside `matchCode`. A hybrid of two highlighters was rejected because the theme vocabularies do not line up.
