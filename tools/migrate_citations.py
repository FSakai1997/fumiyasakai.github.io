"""引用の本文とリンクラベルを言語別 {ja, en} に移行する（一度きり）。

当初は1つの文字列として持っていたため、英語ページでも
「論文を見る →」のような日本語のボタンが出ていた。

英訳が自明なもの（定型のラベル、英語の書誌情報）はここで埋める。
日本語の本文を含む引用は en を空にし、日本語へフォールバックさせる。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# よく使う定型ラベルの対訳。
LABELS = {
    "論文を見る &rarr;": "View the paper &rarr;",
    "詳細はこちら &rarr;": "Details &rarr;",
    "解説記事を見る &rarr;": "View the article &rarr;",
    "大学院生提案型課題の事後評価を見る &rarr;": "View the post-project review &rarr;",
    "記事を読む &rarr;": "Read the article &rarr;",
    "arXivを見る &rarr;": "View on arXiv &rarr;",
    "サイトを閲覧する &rarr;": "Visit the site &rarr;",
    "動画を見る &rarr;": "Watch the video &rarr;",
}

JAPANESE = re.compile(r"[぀-ヿ一-鿿]")


def has_japanese(text: str) -> bool:
    return bool(JAPANESE.search(text or ""))


def to_pair(value, english: str | None = None) -> dict:
    """文字列を {ja, en} にする。すでに辞書ならそのまま返す。"""
    if isinstance(value, dict):
        return value
    text = value or ""
    if english is not None:
        return {"ja": text, "en": english}
    # 日本語を含まないものは、そのまま英語としても使える。
    return {"ja": text, "en": "" if has_japanese(text) else text}


def main() -> int:
    path = ROOT / "data" / "news.json"
    data = json.loads(path.read_text(encoding="utf-8"))

    texts_shared = texts_todo = labels_translated = labels_todo = 0

    for item in data["items"]:
        for citation in item.get("citations", []):
            citation["text"] = to_pair(citation["text"])
            if citation["text"]["en"]:
                texts_shared += 1
            else:
                texts_todo += 1

            for link in citation.get("links", []):
                english = LABELS.get(link["label"]) if isinstance(link["label"], str) else None
                link["label"] = to_pair(link["label"], english)
                if link["label"]["en"]:
                    labels_translated += 1
                else:
                    labels_todo += 1

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"引用本文  : 英語も入った {texts_shared} 件 / 未訳のまま {texts_todo} 件")
    print(f"リンクラベル: 英語も入った {labels_translated} 件 / 未訳のまま {labels_todo} 件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
