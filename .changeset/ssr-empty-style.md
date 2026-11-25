---
'@tanstack/redact': patch
---

Omit the server-rendered `style` attribute when no style property renders, and skip boolean and empty-string style values, as React does.
