# Diagnostics on parseDeck; Refuse stays Inspect

Agents call the same `parseDeck` / `resolveFrame` the adapter uses. `parseDeck` returns `{ deck, diagnostics }` — a closed `kind` union of **Lints** that still yield a **Deck**. `resolveFrame` still returns a **Frame**. On an impossible override, `layout` is the auto pick, `layoutSource` stays `"override"`, and a diagnostic records it. **Refuse** is a paint fact **Inspect** measures; core has no DOM. The **Deck** skill reads the list and points **Refuse** at **Inspect**. A missing `theme.json` throws — there is no **Deck**.

Rejected: a dump function, extra command, MCP, JSON artifact, `console.log` in core (the Vite plugin may `this.warn` the same list), `diagnostics` on **Deck**, `refuse` on **Frame**, `measureRefuse`.
