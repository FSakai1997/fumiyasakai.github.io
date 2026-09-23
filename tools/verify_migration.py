"""移行の忠実性を検証する。

news.html / cv.html と data/*.json を突き合わせ、失われた情報がないことを確認する。
このスクリプトが通らない限り、移行は完了していない。
判定を緩めて通すことは、データを失ったまま先へ進むことと同じであり、許されない。
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class TextExtractor(HTMLParser):
    """HTMLからタグを除いた可視テキストだけを取り出す。"""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        # 空白の差は無視する。タグの入れ子が変わると空白が増減するため。
        return re.sub(r"\s+", "", "".join(self.parts))


def visible_text(html: str) -> str:
    parser = TextExtractor()
    parser.feed(html)
    return parser.text()


def hrefs(html: str) -> set[str]:
    return set(re.findall(r'href="([^"]+)"', html))


def img_srcs(html: str) -> set[str]:
    return set(re.findall(r'<img[^>]+src="([^"]+)"', html))


def article_blocks(html: str) -> list[str]:
    """news.html から <article class="news-card"> ... </article> を切り出す。"""
    blocks = []
    start = 0
    needle = '<article class="news-card">'
    while True:
        i = html.find(needle, start)
        if i == -1:
            break
        j = html.find("</article>", i)
        if j == -1:
            raise ValueError(f"閉じられていない <article> が位置 {i} にあります")
        blocks.append(html[i : j + len("</article>")])
        start = j
    return blocks


def json_article_html(item: dict) -> str:
    """JSONの1記事を、比較用に元のHTML相当の文字列へ連結する。"""
    parts = [item["ja"]["title"], item["ja"]["body"]]
    image = item.get("image")
    if image:
        parts.append(f'<img src="{image["src"]}" alt="{image.get("alt", "")}">')
    for citation in item.get("citations", []):
        parts.append(citation["text"])
        for link in citation.get("links", []):
            parts.append(f'<a href="{link["url"]}">{link["label"]}</a>')
    return "".join(parts)


TAG_NORMALIZATION = {"Publications": "Publication", "Awards": "Award", "NEWS": "News"}


def displayed_date(item: dict) -> str:
    """JSONから、一覧ページに表示されるべき日付文字列を組み立てる。"""
    if item.get("dateLabel"):
        return item["dateLabel"]
    year, month, day = item["date"].split("-")
    return f"{year}.{month}.{day}"


def verify_meta(blocks: list[str], items: list[dict]) -> list[str]:
    """日付とタグが失われていないことを確認する。

    本文比較では news-meta を除いているため、この検査がないと
    日付やタグの取りこぼしを見逃す。
    """
    failures = []
    for index, (block, item) in enumerate(zip(blocks, items)):
        label = f"news[{index}] {item['ja']['title'][:24]}"

        want_date = re.search(r'class="news-date">([^<]*)<', block).group(1).strip()
        got_date = displayed_date(item)
        if want_date != got_date:
            failures.append(f"{label}: 日付不一致 期待={want_date!r} 実際={got_date!r}")

        want_tag = re.search(r'class="news-tag">([^<]*)<', block).group(1).strip()
        expected_tag = TAG_NORMALIZATION.get(want_tag, want_tag)
        if item["tag"] != expected_tag:
            failures.append(f"{label}: タグ不一致 期待={expected_tag!r} 実際={item['tag']!r}")
    return failures


def verify_news() -> list[str]:
    html = (ROOT / "news.html").read_text(encoding="utf-8")
    data = json.loads((ROOT / "data" / "news.json").read_text(encoding="utf-8"))
    items = data["items"]
    blocks = article_blocks(html)

    failures: list[str] = verify_meta(blocks, items)

    if len(blocks) != len(items):
        failures.append(f"件数不一致: news.html={len(blocks)} news.json={len(items)}")

    for index, (block, item) in enumerate(zip(blocks, items)):
        label = f"news[{index}] {item.get('date', '?')} {item['ja']['title'][:24]}"

        # 1. 可視テキストが完全に一致すること。
        #    日付とタグ名はJSONで構造化するため、比較対象から除く。
        block_body = re.sub(r'<div class="news-meta">.*?</div>', "", block, flags=re.S)
        want = visible_text(block_body)
        got = visible_text(json_article_html(item))
        if want != got:
            failures.append(
                f"{label}: 本文テキスト不一致\n"
                f"    期待({len(want)}字)={want[:160]}\n"
                f"    実際({len(got)}字)={got[:160]}"
            )

        # 2. リンクがすべて保存されていること。
        want_links = hrefs(block)
        got_links = hrefs(json_article_html(item)) | {
            link["url"] for c in item.get("citations", []) for link in c.get("links", [])
        }
        missing = want_links - got_links
        if missing:
            failures.append(f"{label}: 失われたリンク {sorted(missing)}")

        # 3. 画像が保存されていること。
        want_imgs = img_srcs(block)
        got_imgs = {item["image"]["src"]} if item.get("image") else set()
        got_imgs |= img_srcs(item["ja"]["body"])
        if want_imgs - got_imgs:
            failures.append(f"{label}: 失われた画像 {sorted(want_imgs - got_imgs)}")

    return failures


def main() -> int:
    failures = verify_news()
    news_count = len(json.loads((ROOT / "data" / "news.json").read_text(encoding="utf-8"))["items"])

    if failures:
        print(f"検証失敗: {len(failures)} 件\n")
        for f in failures:
            print(" -", f)
        return 1

    print(f"検証成功: ニュース {news_count} 件すべてでテキスト・リンク・画像が一致しました")
    return 0


if __name__ == "__main__":
    sys.exit(main())
