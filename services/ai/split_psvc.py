"""Split a Public Service Vacancy Circular into one chunk per post.

Each annexure starts with a department header (closing date, how to apply, notes)
that applies to every post under it, so each chunk = department header + one post.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from pydantic import BaseModel

ANNEXURE_RE = re.compile(r"^\s*ANNEXURE\s+([A-Z]{1,2})\s*$", re.M)
POST_RE = re.compile(r"^\s*POST\s+(\d{1,2}/\d{1,4})\s*$", re.M)
PAGE_NO_RE = re.compile(r"^\s*\d{1,3}\s*$", re.M)


class Chunk(BaseModel):
    chunk_ref: str  # e.g. "42/15"
    annexure: str
    department_header: str
    post_text: str
    page: int

    @property
    def text(self) -> str:
        return f"{self.department_header.strip()}\n\n{self.post_text.strip()}"

    @property
    def title_line(self) -> str:
        lines = [l.strip() for l in self.post_text.splitlines() if l.strip() and l.strip() != ":"]
        return lines[1] if len(lines) > 1 else ""


def _clean(t: str) -> str:
    t = PAGE_NO_RE.sub("", t)
    return re.sub(r"[ \t]+\n", "\n", t)


DEPT_RE = re.compile(
    r"^[ \t]*(DEPARTMENT OF [A-Z][A-Z ,&()'\u2019\-]+|OFFICE OF THE PREMIER|PROVINCIAL TREASURY"
    r"|[A-Z][A-Z ,&()'\u2019\-]+ DEPARTMENT OF [A-Z][A-Z ,&()'\u2019\-]+)[ \t]*$",
    re.M,
)
SUBHEAD_RE = re.compile(r"\n\s*(MANAGEMENT ECHELON|OTHER POSTS)\s*\n?\s*$")


def _section_headers(section: str, posts: list[re.Match]) -> list[tuple[int, str]]:
    """(position, header text) for each department section inside an annexure.

    A provincial annexure holds several departments; each starts with a standalone
    heading line (e.g. "DEPARTMENT OF SOCIAL DEVELOPMENT") followed by that
    department's closing date / application details, then its posts.
    """
    first_post = posts[0].start()
    preamble_lines = section[:first_post]
    # Annexure preamble = text before the first department heading (or before the first post).
    heads = [m for m in DEPT_RE.finditer(section)]
    # Keep headings that are not inside a post title (title follows "POST xx/yy\n:\n").
    valid = []
    for h in heads:
        prev_post = max((p for p in posts if p.start() < h.start()), key=lambda p: p.start(), default=None)
        if prev_post and h.start() - prev_post.end() < 40:
            continue
        valid.append(h)
    annex_pre = section[: valid[0].start()] if valid and valid[0].start() < first_post else ""
    if not valid:
        return [(0, preamble_lines)]
    out = []
    for h in valid:
        nxt = next((p for p in posts if p.start() > h.start()), None)
        if not nxt:
            continue
        out.append((h.start(), annex_pre + section[h.start(): nxt.start()]))
    if not out or out[0][0] > first_post:
        out.insert(0, (0, preamble_lines))
    return out


def split_circular(pages: list[str]) -> list[Chunk]:
    """pages: text of each page (index 0 = page 1)."""
    offsets: list[int] = []
    full = ""
    for p in pages:
        offsets.append(len(full))
        full += _clean(p) + "\n"

    def page_of(pos: int) -> int:
        n = 1
        for i, o in enumerate(offsets):
            if o <= pos:
                n = i + 1
        return n

    annex = list(ANNEXURE_RE.finditer(full))
    chunks: list[Chunk] = []
    for ai, a in enumerate(annex):
        start = a.start()
        end = annex[ai + 1].start() if ai + 1 < len(annex) else len(full)
        section = full[start:end]
        posts = list(POST_RE.finditer(section))
        if not posts:
            continue
        headers = _section_headers(section, posts)
        for pi, p in enumerate(posts):
            pend = posts[pi + 1].start() if pi + 1 < len(posts) else len(section)
            body = section[p.start():pend]
            # Cut the next department's heading off the end of this post's text.
            nxt_head = next((h for h, _ in headers if p.start() < h < pend), None)
            if nxt_head is not None:
                body = section[p.start():nxt_head]
            body = SUBHEAD_RE.sub("\n", body)
            header = next((txt for pos, txt in reversed(headers) if pos <= p.start()), headers[0][1])
            header = SUBHEAD_RE.sub("\n", header)
            chunks.append(
                Chunk(
                    chunk_ref=p.group(1),
                    annexure=a.group(1),
                    department_header=header,
                    post_text=body,
                    page=page_of(start + p.start()),
                )
            )
    return chunks


if __name__ == "__main__":
    import fitz

    doc = fitz.open(sys.argv[1])
    chunks = split_circular([doc[i].get_text() for i in range(doc.page_count)])
    print(f"{len(chunks)} posts")
    for c in chunks:
        dept = next((l.strip() for l in c.department_header.splitlines()[1:] if l.strip()), "")
        print(f"{c.chunk_ref}\t{c.annexure}\tp{c.page}\t{dept[:60]}\t{c.title_line[:70]}")
