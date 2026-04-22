## Browser automation (`effect/unstable/browser`)

Vendor-neutral browser automation lives under `effect/unstable/browser`. The
**driver contract** (`BrowserDriver`, `BrowserPage`) is intentionally small;
**workflow helpers** (`BrowserWorkflow`) build on that contract with standard
`Effect` patterns (scopes, retries, schedules).

See **Capability matrix** (`10_capability-matrix.md`) for which APIs belong in
the contract versus helpers, and how feasible each capability is across typical
drivers (Playwright-class vs lighter embeds).

For a full worked composition (scoped launch, `sequencePage`, `retryFlakyDom`,
`evaluate` + `Schema`), see `20_workflow_retry_schema.ts`.
