---
name: Hyphenated line numbers
description: Classification rule for AutoCAD values that use multiple hyphens.
---

Treat any non-title AutoCAD value containing two or more hyphens (including en/em dashes) as `LINE_NUMBER`.

**Why:** The drawing convention uses multi-segment, hyphenated identifiers for line numbers, including formats that do not necessarily fit the standard piping-line pattern.

**How to apply:** Apply this rule to both loose TEXT/MTEXT entities and block attribute values. Preserve normal single-hyphen instrument tags as instruments.