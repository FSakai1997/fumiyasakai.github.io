"""research.html から data/research.json を生成する（一度きりの移行スクリプト）。

実行後は必ず tools/verify_migration.py で忠実性を確認すること。

注意:
  2つ目のテーマには reverse クラスが付き、画像が反対側に出る。
  これはデータとしては保存しない。描画時に奇数・偶数で自動的に付けるため
  （テーマを増やしたときに左右が自然に交互になる）。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "tools" / "fixtures"

TOPIC = re.compile(r'<section class="research-topic[^"]*">(.*?)</section>', re.S)
HEADING = re.compile(r"<h2>(.*?)</h2>", re.S)
TEXT_BLOCK = re.compile(r'<div class="research-text">(.*?)</div>\s*<div class="research-image">', re.S)
# research-image は section の最後の要素で、中に img-caption の div を持つ。
# 貪欲マッチで最後の </div> まで取ることで、入れ子ごと拾う。
IMAGE_BLOCK = re.compile(r'<div class="research-image">(.*)</div>', re.S)
CAPTION = re.compile(r'<div class="img-caption">(.*?)</div>', re.S)
IMG = re.compile(r"<img\b([^>]*)>", re.S)


def attr(tag_attrs: str, name: str) -> str:
    m = re.search(rf'\b{name}="([^"]*)"', tag_attrs)
    return m.group(1) if m else ""


def tidy(html: str) -> str:
    """字下げによる改行を畳む。全角空白など意味のある空白は触らない。"""
    return re.sub(r"\n\s*", " ", html).strip()


def parse_topic(block: str, index: int) -> dict:
    heading_match = HEADING.search(block)
    if not heading_match:
        raise ValueError(f"テーマ {index} に <h2> がありません")
    # 見出しは <br> を含むため、HTMLのまま保持する。
    heading = tidy(heading_match.group(1))

    text_match = TEXT_BLOCK.search(block)
    if not text_match:
        raise ValueError(f"テーマ {index} の research-text が読み取れません")
    # 元のHTMLの字下げをそのまま残すと、管理画面の編集欄が読みにくい。
    # 段落ごとに1行へ畳む。ブラウザは空白を詰めて表示するので見た目は変わらない。
    body = tidy(HEADING.sub("", text_match.group(1), count=1))
    body = re.sub(r"</p>\s*<p", "</p>\n<p", body)

    image = None
    image_match = IMAGE_BLOCK.search(block)
    if image_match:
        inner = image_match.group(1)
        img = IMG.search(inner)
        caption = CAPTION.search(inner)
        if img:
            image = {
                "src": attr(img.group(1), "src"),
                "alt": {"ja": attr(img.group(1), "alt"), "en": ""},
                "caption": {"ja": tidy(caption.group(1)) if caption else "", "en": ""},
            }

    return {
        "id": f"topic-{index}",
        "heading": {"ja": heading, "en": ""},
        "body": {"ja": body, "en": ""},
        "image": image,
    }


def main() -> int:
    html = (FIXTURES / "research.original.html.txt").read_text(encoding="utf-8")
    start = html.index('<div class="container">')
    end = html.index('<section id="contact"', start)
    container = html[start:end]

    blocks = TOPIC.findall(container)
    print(f"{len(blocks)} 件の研究テーマを検出しました")

    topics = []
    for index, block in enumerate(blocks, start=1):
        topic = parse_topic(block, index)
        heading_text = re.sub(r"<[^>]+>", "", topic["heading"]["ja"])
        print(f"  {topic['id']}: {heading_text[:40]}")
        if topic["image"]:
            print(f"    画像 {topic['image']['src']}")
        topics.append(topic)

    out = ROOT / "data" / "research.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(
        json.dumps({"schemaVersion": 1, "topics": topics}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"書き出しました: {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
