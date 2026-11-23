---
'@tanstack/redact': patch
---

Show the fallback when a child suspends while a Suspense boundary client-renders after a hydration mismatch, instead of throwing a `RenderSuspenseCapture` out of `hydrateRoot` and leaving the boundary empty.
