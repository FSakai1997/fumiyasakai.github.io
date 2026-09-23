"""移行の忠実性を検証する。

移行前の news.html / cv.html と data/*.json を突き合わせ、
失われた情報がないことを確認する。

比較元は tools/fixtures/ に固定保存した移行前のHTMLである。
公開中の news.html / cv.html は描画型に書き換わっており、
記事本文を持たないため比較には使えない。この固定データがある限り、
データ構造をあとから変更しても「元の内容を失っていないか」を
いつでも確かめられる。

このスクリプトが通らない限り、移行は完了していない。
判定を緩めて通すことは、データを失ったまま先へ進むことと同じであり、許されない。
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tools" / "fixtures"

TAG_NORMALIZATION = {"Publications": "Publication", "Awards": "Award", "NEWS": "News"}


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


def first_difference(want: str, got: str) -> str:
    """長い文字列どうしの、最初に食い違った位置とその前後を示す。"""
    common = 0
    while common < min(len(want), len(got)) and want[common] == got[common]:
        common += 1
    return (
        f"{len(want)}字 vs {len(got)}字, {common}字目から相違\n"
        f"    期待={want[common:common + 120]}\n"
        f"    実際={got[common:common + 120]}"
    )


# --------------------------------------------------------------------------
# ニュース
# --------------------------------------------------------------------------


def article_blocks(html: str) -> list[str]:
    """news.html から <article class="news-card"> ... </article> を切り出す。"""
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


def verify_news() -> tuple[list[str], int]:
    html = (FIXTURES / "news.original.html.txt").read_text(encoding="utf-8")
    data = json.loads((ROOT / "data" / "news.json").read_text(encoding="utf-8"))
    items = data["items"]
    blocks = article_blocks(html)

    failures: list[str] = verify_meta(blocks, items)

    if len(blocks) != len(items):
        failures.append(f"件数不一致: news.html={len(blocks)} news.json={len(items)}")

    for index, (block, item) in enumerate(zip(blocks, items)):
        label = f"news[{index}] {item.get('date', '?')} {item['ja']['title'][:24]}"

        # 1. 可視テキストが完全に一致すること。日付とタグは verify_meta が見る。
        block_body = re.sub(r'<div class="news-meta">.*?</div>', "", block, flags=re.S)
        want = visible_text(block_body)
        got = visible_text(json_article_html(item))
        if want != got:
            failures.append(f"{label}: 本文テキスト不一致 " + first_difference(want, got))

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

    return failures, len(items)


# --------------------------------------------------------------------------
# CV
# --------------------------------------------------------------------------


def cv_container(html: str) -> str:
    """cv.html のうち、CV本体だけを切り出す。

    ナビゲーション・ページヘッダ・Contact 節・フッタは移行対象外なので
    比較範囲から除く。
    """
    start = html.index('<div class="container cv-container"')
    start = html.index(">", start) + 1
    end = html.index('<section id="contact"', start)
    # Contact 節の直前にある </div> は cv-container の閉じタグなので落とす。
    return html[start:end].rstrip().removesuffix("</div>")


def cv_parts(data: dict) -> list[str]:
    """cv.json の全内容を、比較用の文字列の並びにする。"""
    parts = ["Profile", data["profile"]["ja"]["name"], *data["profile"]["ja"]["lines"]]
    for section in data["sections"]:
        parts.append(section["heading"])
        for entry in section["entries"]:
            parts.append(entry.get("date") or "")
            parts.append(entry.get("ja") or "")
    return parts


def verify_cv() -> tuple[list[str], int, int]:
    html = (FIXTURES / "cv.original.html.txt").read_text(encoding="utf-8")
    data = json.loads((ROOT / "data" / "cv.json").read_text(encoding="utf-8"))
    body = cv_container(html)
    failures: list[str] = []

    want_headings = [h.strip() for h in re.findall(r'<h2 class="cv-heading">(.*?)</h2>', body, re.S)]
    got_headings = ["Profile"] + [s["heading"] for s in data["sections"]]
    if want_headings != got_headings:
        failures.append(f"見出し不一致\n    期待={want_headings}\n    実際={got_headings}")

    parts = cv_parts(data)
    want_text = visible_text(body)
    got_text = visible_text("".join(parts))
    if want_text != got_text:
        failures.append("CV本文テキスト不一致 " + first_difference(want_text, got_text))

    missing = hrefs(body) - hrefs("".join(parts))
    if missing:
        failures.append(f"CVで失われたリンク {sorted(missing)}")

    entry_total = sum(len(s["entries"]) for s in data["sections"])
    return failures, len(data["sections"]), entry_total


# --------------------------------------------------------------------------
# 研究紹介
# --------------------------------------------------------------------------


def research_container(html: str) -> str:
    """research.html のうち、研究テーマ本体だけを切り出す。"""
    start = html.index('<div class="container">')
    start = html.index(">", start) + 1
    end = html.index('<section id="contact"', start)
    return html[start:end].rstrip().removesuffix("</div>")


def research_parts(data: dict) -> list[str]:
    """research.json の全内容を、比較用の文字列の並びにする。"""
    parts = []
    for topic in data["topics"]:
        parts.append(topic["heading"]["ja"])
        parts.append(topic["body"]["ja"])
        image = topic.get("image") or {}
        caption = (image.get("caption") or {}).get("ja", "")
        parts.append(caption)
    return parts


def verify_research() -> tuple[list[str], int]:
    html = (FIXTURES / "research.original.html.txt").read_text(encoding="utf-8")
    data = json.loads((ROOT / "data" / "research.json").read_text(encoding="utf-8"))
    body = research_container(html)
    failures: list[str] = []

    want_topics = len(re.findall(r'<section class="research-topic', body))
    if want_topics != len(data["topics"]):
        failures.append(
            f"テーマ数不一致: research.html={want_topics} research.json={len(data['topics'])}"
        )

    want_headings = [visible_text(h) for h in re.findall(r"<h2>(.*?)</h2>", body, re.S)]
    got_headings = [visible_text(t["heading"]["ja"]) for t in data["topics"]]
    if want_headings != got_headings:
        failures.append(f"見出し不一致\n    期待={want_headings}\n    実際={got_headings}")

    parts = research_parts(data)
    want_text = visible_text(body)
    got_text = visible_text("".join(parts))
    if want_text != got_text:
        failures.append("研究紹介の本文テキスト不一致 " + first_difference(want_text, got_text))

    missing = hrefs(body) - hrefs("".join(parts))
    if missing:
        failures.append(f"研究紹介で失われたリンク {sorted(missing)}")

    want_imgs = img_srcs(body)
    got_imgs = {t["image"]["src"] for t in data["topics"] if t.get("image")}
    if want_imgs - got_imgs:
        failures.append(f"研究紹介で失われた画像 {sorted(want_imgs - got_imgs)}")

    return failures, len(data["topics"])


# --------------------------------------------------------------------------


def main() -> int:
    news_failures, news_count = verify_news()
    cv_failures, cv_sections, cv_entries = verify_cv()
    research_failures, research_topics = verify_research()
    failures = news_failures + cv_failures + research_failures

    if failures:
        print(f"検証失敗: {len(failures)} 件\n")
        for f in failures:
            print(" -", f)
        return 1

    print(f"検証成功: ニュース {news_count} 件でテキスト・リンク・画像・日付・タグが一致しました")
    print(f"検証成功: CV {cv_sections} セクション / {cv_entries} エントリで見出し・テキスト・リンクが一致しました")
    print(f"検証成功: 研究紹介 {research_topics} テーマで見出し・テキスト・リンク・画像が一致しました")
    return 0


if __name__ == "__main__":
    sys.exit(main())
