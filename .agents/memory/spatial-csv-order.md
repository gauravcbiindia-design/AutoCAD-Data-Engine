---
name: Spatial CSV order
description: Keep extracted data ordered like the drawing layout.
---

Order each drawing's raw export in the same visual reading direction as the drawing: top-to-bottom, then left-to-right. Do not add synthetic grouping rows that move labels away from their source location.

**Why:** Engineers need nearby drawing labels to remain nearby in the CSV, so the spreadsheet is a readable spatial representation of the P&ID/PFD rather than a category-only list.

**How to apply:** Use the source entity coordinates for export ordering; when entities share a location, preserve their original DXF sequence.