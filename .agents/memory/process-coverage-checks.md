---
name: Process coverage checks
description: Future QA logic for detecting missing or inconsistent process information from P&ID/PFD drawings.
---

The tool should behave as a second-engineer review layer: use legend semantics, entity/block structure, geometry, line connectivity, and nearby text relationships to identify information that may have been missed during engineering or drafting.

**Why:** Extraction alone can faithfully export an incomplete drawing. Process understanding and coverage checks can identify orphaned, inconsistent, or suspicious items before they reach review.

**How to apply:**
- Build a semantic graph of equipment, pipes/line numbers, valves, instruments, arrows, streams, and connection points.
- Flag instrument bubbles whose upper function text or lower value is missing, misaligned, duplicated, or inconsistent with the legend.
- Flag lines or streams that terminate unexpectedly, have no connected equipment, or contain incomplete identification.
- Flag equipment with suspiciously missing inlet/outlet connections, duplicate tags, or unclassified nearby engineering text.
- Compare visible drawing text, block attributes, and inferred relationships to detect disagreements.
- Produce a review queue with the exact drawing location, related entities, reason, and confidence; never silently invent engineering values.
- Use the same semantic model in Magnifier so users can see both what the process appears to be and where the drawing needs human review.