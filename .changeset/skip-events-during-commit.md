---
'@tanstack/redact': patch
---

Ignore DOM events that a commit's own DOM writes dispatch, as React does. Chrome fires `blur` on a focused element just before removing it, so a removed input's `onBlur` ran after the update that removed it.
