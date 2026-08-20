from pathlib import Path
import fitz

PDFS = [
    Path("attached_assets/0_A1-C-Model_1787224362481.pdf"),
    Path("attached_assets/1_A1-B-Model_1787224362498.pdf"),
    Path("attached_assets/2_A1-A-Model_1787224362507.pdf"),
]

OUTPUT = Path(".agents/outputs/legend-inspection")
OUTPUT.mkdir(parents=True, exist_ok=True)

for pdf_path in PDFS:
    doc = fitz.open(pdf_path)
    print(f"\n{pdf_path.name}: {len(doc)} page(s)")
    for page_index, page in enumerate(doc):
        # A moderate render is enough to inspect the full sheet while keeping
        # output manageable. Higher-resolution crops can be added after review.
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        image_path = OUTPUT / f"{pdf_path.stem}-page-{page_index + 1}.png"
        pix.save(image_path)

        text = page.get_text("text").replace("\n", " | ")
        print(f"  page {page_index + 1}: {page.rect.width:.0f}x{page.rect.height:.0f} pt")
        print(f"    text: {text[:1200]}")

        blocks = page.get_text("dict").get("blocks", [])
        text_blocks = [block for block in blocks if block.get("type") == 0]
        print(f"    text blocks: {len(text_blocks)}; embedded images: {len(page.get_images(full=True))}")

print(f"\nRendered previews: {OUTPUT}")