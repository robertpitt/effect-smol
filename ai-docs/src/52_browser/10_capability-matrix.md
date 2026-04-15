# Browser capability matrix

This document inventories automation capabilities and where they should live:
**contract** (`BrowserPage` / `BrowserDriver` in `effect/unstable/browser`) vs
**helpers** (`BrowserWorkflow`, user code) vs **driver-specific** layers
(`@effect/platform-node`, future adapters).

| Capability                                 | Contract                            | Feasibility                       | Notes                                                                                                       |
| ------------------------------------------ | ----------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Launch / context / page lifecycle          | `BrowserDriver`, `BrowserSession`   | High (CDP, Playwright, WebDriver) | Core scope + finalizers                                                                                     |
| `goto`, `reload`, `goBack`                 | `BrowserPage`                       | High                              | History and reload differ slightly on WebDriver but are universal                                           |
| `waitForSelector`, `waitForLoadState`      | `BrowserPage`                       | High                              | Map load states to a neutral enum (`BrowserWaitUntil` + `commit`)                                           |
| `waitForURL` (string / URL)                | `BrowserPage`                       | Medium–High                       | Regex / predicate matchers are often driver-specific; string URL is portable                                |
| `click`, `fill`                            | `BrowserPage`                       | High                              | Selector strings are the portable baseline                                                                  |
| `title`, `content`                         | `BrowserPage`                       | High                              |                                                                                                             |
| `text`, `innerText`, `getAttribute`        | `BrowserPage`                       | High                              | Prefer over scraping full `content` HTML                                                                    |
| `evaluate` (serialized function or string) | `BrowserPage`                       | Medium                            | All serious drivers support in-page JS; sandboxed embeds may restrict or disallow                           |
| `screenshot` (bytes)                       | `BrowserPage`                       | High                              | Format options (`png` / `jpeg`) are widely supported                                                        |
| **Traces** (artifact zip / viewer)         | Launch options or driver layer      | Low–Medium                        | Highly vendor-specific (Playwright trace); neutral contract may only expose `tapLaunch` / `transform` hooks |
| **Frames**                                 | Optional future handle type         | Medium                            | Needs a stable handle model (`FrameId` or nested `BrowserPage`)                                             |
| **Network interception**                   | Driver-specific or future extension | Low                               | CDP vs Playwright route API vs WebDriver BiDi differ sharply                                                |
| **File upload / downloads**                | Future contract slice               | Medium                            | Often modeled as paths or streams per platform                                                              |
| **Retries, multi-step flows**              | `BrowserWorkflow` / user `Effect`   | High                              | Pure Effect: `Schedule`, `Effect.retry`, `Effect.gen`                                                       |
| **Typed extraction**                       | Helpers + `Schema`                  | High                              | Decode `evaluate` JSON or structured fields in user/helper code                                             |

**Rule of thumb:** put **I/O that every serious automation backend can implement**
on `BrowserPage`. Put **composition, retries, and decoding** in
`BrowserWorkflow` or application code. Put **vendor artifacts** (trace viewer,
HAR, route mocking) in platform packages or optional capabilities documented as
non-portable.
