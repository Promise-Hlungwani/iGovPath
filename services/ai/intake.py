"""PDF -> text blocks with page number and position (PyMuPDF), OCR fallback for scanned pages."""
from __future__ import annotations

import hashlib
import shutil
import subprocess
import tempfile
from pathlib import Path

import fitz  # PyMuPDF
from pydantic import BaseModel


class TextBlock(BaseModel):
    text: str
    bbox: tuple[float, float, float, float]


class PageText(BaseModel):
    page: int
    text: str
    blocks: list[TextBlock]
    ocr: bool = False


class IntakeResult(BaseModel):
    sha256: str
    page_count: int
    pages: list[PageText]


def _ocr_page(page: fitz.Page) -> str:
    """Tesseract fallback for pages without a text layer. Returns '' if Tesseract isn't installed."""
    if not shutil.which("tesseract"):
        return ""
    pix = page.get_pixmap(dpi=300)
    with tempfile.TemporaryDirectory() as tmp:
        img = Path(tmp) / "page.png"
        pix.save(img)
        out = subprocess.run(["tesseract", str(img), "-", "-l", "eng"], capture_output=True, text=True, timeout=120)
        return out.stdout


def intake_pdf(data: bytes, max_pages: int | None = None) -> IntakeResult:
    sha = hashlib.sha256(data).hexdigest()
    doc = fitz.open(stream=data, filetype="pdf")
    pages: list[PageText] = []
    n = doc.page_count if max_pages is None else min(doc.page_count, max_pages)
    for i in range(n):
        page = doc[i]
        blocks = [
            TextBlock(text=b[4].strip(), bbox=(round(b[0], 1), round(b[1], 1), round(b[2], 1), round(b[3], 1)))
            for b in page.get_text("blocks")
            if b[6] == 0 and b[4].strip()
        ]
        text = page.get_text()
        ocr = False
        if not text.strip():
            text = _ocr_page(page)
            ocr = True
        pages.append(PageText(page=i + 1, text=text, blocks=blocks, ocr=ocr))
    return IntakeResult(sha256=sha, page_count=doc.page_count, pages=pages)
