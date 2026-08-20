---
name: Spreadsheet-safe CSV exports
description: Prevent Excel from evaluating engineering identifiers as formulas during CSV export and import.
---

All data extracted from AutoCAD must be treated as engineering text, never as a spreadsheet formula. Values that begin with `=`, `+`, `-`, or `@` must be exported as spreadsheet-safe text, then restored before DXF write-back.

**Why:** Excel treats leading formula characters as a calculation. Identifiers such as `-A03AB1-HC` can become `#NAME?`, and that error can then be saved back into the AutoCAD drawing.

**How to apply:** Whenever CSV output is intended for Excel, prefix formula-like values with a text marker on export. The corresponding importer must remove only that known marker before using the value in engineering data or DXF patches. Never evaluate, calculate, or silently convert AutoCAD-originated strings.