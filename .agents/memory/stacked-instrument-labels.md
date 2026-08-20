---
name: Stacked instrument labels
description: Handling for two-line AutoCAD instrument bubbles.
---

Treat the text at the top of an instrument bubble as the instrument type and the numeric text below it as the instrument loop number. Use drawing geometry as the primary pairing signal rather than a fixed project code list. Export each value on its original drawing-text row in one `Instrument` column, while retaining a combined display value internally.

**Why:** Function codes and attribute names differ by project, but the drawing consistently presents the code immediately above its corresponding loop value (for example, `XYZ` above `12105`).

**How to apply:** Preserve ATTRIB coordinates and pair a short, code-like upper value with a horizontally aligned numeric lower value in the same block; apply the same spatial rule to loose TEXT/MTEXT on the same layer. When a recognized loose instrument label has no lower source value, preserve the blank lower field for engineer review, but never invent or write an unverified value back into the DXF. Known code dictionaries remain a fallback, not a requirement. Keep original positions in the raw export rather than adding generated summary rows.