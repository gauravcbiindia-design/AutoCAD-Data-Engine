---
name: Legend semantic model
description: Shared engineering interpretation derived from P&ID/PFD legends for extraction and future drawing inspection tools.
---

Use the project legends as the semantic reference for both AutoCAD Data Engine and the future Magnifier app. The legend explains what a drawing text means from its symbol, position, and relationship to nearby text—not only from the literal spelling of a function code.

**Why:** Function-code and attribute names vary between projects, while the drawing conventions remain stable enough to identify relationships such as an upper instrument function text and its lower loop/value text.

**How to apply:**
- Instrument bubbles: interpret the upper text as function/instrument text and the vertically aligned lower text as its corresponding value or loop number.
- Use entity/block membership and drawing coordinates as primary evidence; fixed ISA/project code dictionaries are optional fallbacks.
- Keep paired source values on their original rows and preserve spatial reading order; do not replace them with artificial summary rows.
- Use the instrumentation legend for function/value semantics, the line-identification legend for piping/line values, and the equipment legend for equipment symbols and tags.
- Build Magnifier explanations and overlays from these semantic relationships so it can explain what a text represents and why it is paired with a nearby value.