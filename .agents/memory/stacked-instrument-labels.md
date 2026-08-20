---
name: Stacked instrument labels
description: Handling for two-line AutoCAD instrument bubbles.
---

Treat the text at the top of an instrument bubble as the instrument type and the numeric text below it as the instrument loop number. Export each value on its original drawing-text row in one `Instrument` column, while retaining a combined display value internally.

**Why:** The drawings present instrument identifiers vertically (for example, `XYZ` above `12105`), so exporting only the individual text values loses the engineering relationship.

**How to apply:** Preserve the paired type and number for standard and approved project-specific instrument codes, whether supplied as block attributes or vertically aligned loose text. Keep their original positions in the raw export rather than adding generated summary rows.