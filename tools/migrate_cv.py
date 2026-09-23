"""cv.html から data/cv.json を生成する（一度きりの移行スクリプト）。

実行後は必ず tools/verify_migration.py で忠実性を確認すること。

既存HTMLの注意点:
  Lectures セクションは <div class="cv-grid"> が閉じられていない。
  そのため cv-grid の中身は </section> を境界として扱う。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tools" / "fixtures"

SECTION = re.compile(r'<section class="cv-section">(.*?)</section>', re.S)
HEADING = re.compile(r'<h2 class="cv-heading">(.*?)</h2>', re.S)
LIST_OPEN = re.compile(r'<ol class="([^"]*)"[^>]*>', re.S)
LIST_ITEM = re.compile(r"<li>(.*?)</li>", re.S)
CV_DATE = re.compile(r'<div class="cv-date">(.*?)</div>', re.S)
PROFILE_NAME = re.compile(r"<p><strong>(.*?)</strong></p>", re.S)
PROFILE_LINE = re.compile(r"<li>(.*?)</li>", re.S)
CELL = re.compile(r'<div class="(cv-date|cv-content)">(.*?)</div>', re.S)


def tidy(html: str) -> str:
    """字下げによる改行を畳む。全角空白など意味のある空白は触らない。"""
    return re.sub(r"\n\s*", " ", html).strip()


def slugify(heading: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", heading.lower()).strip("-")
    return slug or "section"


def parse_dated_section(body: str) -> list[dict]:
    """cv-date と cv-content の対を取り出す。

    cv-content の中身はHTMLのまま残す（<a> を含むため）。
    Lectures のように cv-grid が閉じられていなくても、
    cv-date / cv-content を直接拾うので影響を受けない。
    """
    entries: list[dict] = []
    for kind, value in CELL.findall(body):
        value = tidy(value)
        if kind == "cv-date":
            entries.append({"date": value, "ja": "", "en": ""})
        else:
            if not entries:
                entries.append({"date": "", "ja": "", "en": ""})
            entries[-1]["ja"] = value
    return entries


def parse_numbered_section(body: str) -> tuple[str, list[dict]]:
    """<ol> の各 <li> を取り出す。リストのクラス名も返す。"""
    list_class = LIST_OPEN.search(body).group(1).strip()
    entries = [{"date": "", "ja": tidy(item), "en": ""} for item in LIST_ITEM.findall(body)]
    return list_class, entries


def parse_profile(body: str) -> dict:
    name = PROFILE_NAME.search(body)
    lines = [tidy(line) for line in PROFILE_LINE.findall(body)]
    return {
        "ja": {"name": tidy(name.group(1)) if name else "", "lines": lines},
        "en": {"name": "", "lines": []},
    }


def main() -> int:
    html = (FIXTURES / "cv.original.html.txt").read_text(encoding="utf-8")
    start = html.index('<div class="container cv-container"')
    end = html.index('<section id="contact"', start)
    container = html[start:end]

    blocks = SECTION.findall(container)
    print(f"{len(blocks)} 個のセクションを検出しました")

    profile: dict | None = None
    sections: list[dict] = []

    for block in blocks:
        heading = tidy(HEADING.search(block).group(1))
        body = HEADING.sub("", block, count=1)

        if heading == "Profile":
            profile = parse_profile(body)
            print(f"  Profile: {len(profile['ja']['lines'])} 行")
            continue

        if LIST_OPEN.search(body):
            list_class, entries = parse_numbered_section(body)
            section = {
                "id": slugify(heading),
                "heading": heading,
                "type": "numbered",
                "listClass": list_class,
                "entries": entries,
            }
        else:
            entries = parse_dated_section(body)
            section = {
                "id": slugify(heading),
                "heading": heading,
                "type": "dated",
                "entries": entries,
            }
        sections.append(section)
        print(f"  {heading}: {section['type']} / {len(entries)} 件")

    if profile is None:
        raise ValueError("Profile セクションが見つかりません")

    out = ROOT / "data" / "cv.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(
        json.dumps(
            {"schemaVersion": 1, "profile": profile, "sections": sections},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"書き出しました: {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
