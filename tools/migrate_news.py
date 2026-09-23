"""news.html から data/news.json を生成する（一度きりの移行スクリプト）。

実行後は必ず tools/verify_migration.py で忠実性を確認すること。
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tools" / "fixtures"

# タグの表記揺れを多数派に寄せる。
TAG_NORMALIZATION = {
    "Publications": "Publication",
    "Awards": "Award",
    "NEWS": "News",
}

DIV_TAG = re.compile(r"<div\b|</div\s*>")
DIV_OPEN_WITH_CLASS = re.compile(r'<div\b[^>]*\bclass="([^"]*)"[^>]*>')


def extract_div(html: str, class_name: str, start: int = 0):
    """class_name を持つ最初の <div> を、入れ子を数えて切り出す。

    戻り値: (開始位置, 終了位置(</div>の直後), 内側HTML)。見つからなければ None。
    """
    pos = start
    while True:
        opening = DIV_OPEN_WITH_CLASS.search(html, pos)
        if not opening:
            return None
        if class_name in opening.group(1).split():
            break
        pos = opening.end()

    inner_start = opening.end()
    depth = 1
    scan = inner_start
    while depth:
        tag = DIV_TAG.search(html, scan)
        if not tag:
            raise ValueError(f'<div class="{class_name}"> が閉じられていません')
        depth += -1 if tag.group(0).startswith("</") else 1
        if depth == 0:
            return opening.start(), tag.end(), html[inner_start:tag.start()]
        scan = tag.end()


def extract_all_divs(html: str, class_name: str):
    """class_name を持つ <div> をすべて切り出す。位置の昇順で返す。"""
    found = []
    pos = 0
    while True:
        result = extract_div(html, class_name, pos)
        if not result:
            return found
        found.append(result)
        pos = result[1]


def remove_spans(html: str, spans) -> str:
    """(開始, 終了) の区間を後ろから削除する。"""
    for start, end in sorted(spans, reverse=True):
        html = html[:start] + html[end:]
    return html


def attr(tag_attrs: str, name: str) -> str:
    m = re.search(rf'\b{name}="([^"]*)"', tag_attrs)
    return m.group(1) if m else ""


def article_blocks(html: str) -> list[str]:
    blocks = []
    start = 0
    needle = '<article class="news-card">'
    while True:
        i = html.find(needle, start)
        if i == -1:
            return blocks
        j = html.find("</article>", i)
        if j == -1:
            raise ValueError(f"閉じられていない <article> が位置 {i} にあります")
        blocks.append(html[i : j + len("</article>")])
        start = j


def parse_image(inner: str, body_classes: str) -> dict | None:
    """news-image の中身から画像情報を取り出す。"""
    m = re.search(r"<img\b([^>]*)>", inner)
    if not m:
        return None
    attrs = m.group(1)
    image = {"src": attr(attrs, "src"), "alt": attr(attrs, "alt")}
    # has-image は本文と横並び、そうでなければ中央寄せの大きな画像。
    image["layout"] = "side" if "has-image" in body_classes.split() else "center"
    width = re.search(r"width:\s*([^;\"]+)", attr(attrs, "style"))
    if width:
        image["width"] = width.group(1).strip()
    return image


CITATION_LINK = re.compile(r"<a\b([^>]*)>(.*?)</a>", re.S)
PARAGRAPH_BOUNDARY = re.compile(r"</p>\s*<p\b[^>]*>", re.S)
PARAGRAPH_TAG = re.compile(r"</?p\b[^>]*>", re.S)
SEPARATOR = "@@CITATION_SPLIT@@"


def _citation_texts(segment: str) -> list[str]:
    """引用ボックスの断片から、段落ごとの本文を取り出す。

    既存HTMLには <p></p> が空だったり、<p> がそもそも無かったり、
    閉じタグだけが余分にあったりする壊れた引用ボックスが5件ある。
    <p> の有無に頼らず、テキストそのものを拾う。
    """
    segment = PARAGRAPH_BOUNDARY.sub(SEPARATOR, segment)
    segment = PARAGRAPH_TAG.sub("", segment)
    texts = []
    for part in segment.split(SEPARATOR):
        # 行頭の字下げだけを畳む。全角空白などの意味のある空白は触らない。
        part = re.sub(r"\n\s*", " ", part).strip()
        if part:
            texts.append(part)
    return texts


def parse_citations(inner: str) -> list[dict]:
    """引用ボックスの中身を、本文と、それに続くリンクへ分解する。"""
    citations: list[dict] = []
    pos = 0
    for link in CITATION_LINK.finditer(inner):
        for text in _citation_texts(inner[pos : link.start()]):
            citations.append({"text": text, "links": []})
        if not citations:
            citations.append({"text": "", "links": []})
        citations[-1]["links"].append(
            {"label": link.group(2).strip(), "url": attr(link.group(1), "href")}
        )
        pos = link.end()
    for text in _citation_texts(inner[pos:]):
        citations.append({"text": text, "links": []})
    return citations


SINGLE_DATE = re.compile(r"^(\d{4})\.(\d{2})\.(\d{2})$")
DAY_RANGE = re.compile(r"^(\d{4})\.(\d{2})\.(\d{2})-\d{1,2}$")
MONTH_RANGE = re.compile(r"^(\d{4})\.(\d{2})-\d{1,2}$")


def parse_date(raw: str) -> tuple[str, str]:
    """表示用の日付文字列を (並べ替え用ISO日付, 表示ラベル) に分解する。

    学会参加などの記事は "2023.12.11-15" や "2024.09-12" のような期間表記を使う。
    期間は開始日で並べ替え、表示は原文のまま残す。
    """
    m = SINGLE_DATE.match(raw)
    if m:
        return f"{m[1]}-{m[2]}-{m[3]}", ""
    m = DAY_RANGE.match(raw)
    if m:
        return f"{m[1]}-{m[2]}-{m[3]}", raw
    m = MONTH_RANGE.match(raw)
    if m:
        return f"{m[1]}-{m[2]}-01", raw
    raise ValueError(f"解釈できない日付表記です: {raw!r}")


def parse_article(block: str) -> dict:
    date_raw = re.search(r'class="news-date">([^<]*)<', block).group(1).strip()
    date, date_label = parse_date(date_raw)

    tag_raw = re.search(r'class="news-tag">([^<]*)<', block).group(1).strip()
    tag = TAG_NORMALIZATION.get(tag_raw, tag_raw)

    title = re.search(r'<h3 class="news-title">(.*?)</h3>', block, re.S).group(1).strip()

    body_start, body_end, body_inner = extract_div(block, "news-body")
    body_classes = DIV_OPEN_WITH_CLASS.search(block, body_start).group(1)

    # 画像を本文から切り離す。
    image = None
    image_divs = extract_all_divs(body_inner, "news-image")
    if image_divs:
        image = parse_image(image_divs[0][2], body_classes)
        body_inner = remove_spans(body_inner, [(s, e) for s, e, _ in image_divs])

    # 引用ボックスを本文から切り離す。本文の外にある記事も1件あるため、両方を探す。
    citations: list[dict] = []
    inside = extract_all_divs(body_inner, "citation-box")
    for _, _, inner in inside:
        citations.extend(parse_citations(inner))
    body_inner = remove_spans(body_inner, [(s, e) for s, e, _ in inside])

    outside_scope = block[:body_start] + block[body_end:]
    for _, _, inner in extract_all_divs(outside_scope, "citation-box"):
        citations.extend(parse_citations(inner))

    return {
        "date": date,
        "dateLabel": date_label,
        "tag": tag,
        "tag_raw": tag_raw,
        "draft": False,
        "ja": {"title": title, "body": body_inner.strip()},
        "en": {"title": "", "body": ""},
        "image": image,
        "citations": citations,
    }


def main() -> int:
    html = (FIXTURES / "news.original.html").read_text(encoding="utf-8")
    blocks = article_blocks(html)
    print(f"{len(blocks)} 件の記事を検出しました")

    items = []
    per_date = Counter()
    renamed = Counter()
    for block in blocks:
        item = parse_article(block)
        if item["tag_raw"] != item["tag"]:
            renamed[f'{item["tag_raw"]} → {item["tag"]}'] += 1
        del item["tag_raw"]
        per_date[item["date"]] += 1
        item = {"id": f'{item["date"]}-{per_date[item["date"]]}', **item}
        items.append(item)

    if renamed:
        print("タグの表記を正規化しました:")
        for change, count in sorted(renamed.items()):
            print(f"  {change}  ({count} 件)")

    ranged = sum(1 for i in items if i["dateLabel"])
    if ranged:
        print(f"期間表記の日付 {ranged} 件は dateLabel に原文を保存しました")

    with_image = sum(1 for i in items if i["image"])
    with_citation = sum(1 for i in items if i["citations"])
    print(f"画像あり {with_image} 件 / 引用あり {with_citation} 件")

    out = ROOT / "data" / "news.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(
        json.dumps({"schemaVersion": 1, "items": items}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"書き出しました: {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
