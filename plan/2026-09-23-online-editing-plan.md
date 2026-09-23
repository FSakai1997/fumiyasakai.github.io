# オンライン編集機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `fumiyasakai.github.io` のニュースとCVを、ブラウザ上の管理画面から追加・編集・削除できるようにする。

**Architecture:** 記事データを `news.html` / `cv.html` から `data/*.json` に抽出し、公開ページは読み込み時にJSONから描画する。管理画面 `admin/` は GitHub Contents API を直接叩き、利用者の Fine-grained Personal Access Token で認証して `main` ブランチにコミットする。GitHub Pages が自動で再公開する。サーバーもビルド工程も追加しない。

**Tech Stack:** 素のHTML / CSS / ES モジュール（フレームワークなし、依存パッケージなし）、GitHub REST API v3、移行スクリプトは Python 3.12 標準ライブラリのみ、単体テストは Node 24 組み込みの `node --test`。

**Spec:** `plan/2026-09-23-online-editing-design.md`

## Global Constraints

- **リポジトリ:** `FSakai1997/fumiyasakai.github.io`、ブランチ `main`
- **依存パッケージの追加は禁止。** `npm install` も `pip install` も行わない。Python は標準ライブラリのみ、JS は組み込みAPIのみ。
- **文字コードは UTF-8。** 日本語を含むため、base64 変換に素の `btoa()` を使ってはならない（`TextEncoder` 経由が必須）。
- **`style.css` は変更しない。** 既存のクラス名（`news-card`, `news-meta`, `news-date`, `news-tag`, `news-title`, `news-body`, `has-image`, `news-image`, `citation-box`, `btn-sm`, `year-toggle`, `year-archive`, `cv-section`, `cv-heading`, `cv-grid`, `cv-date`, `cv-content`, `cv-profile-list`, `publication-list`, `presentation-list`）に完全に一致するHTMLを生成すること。
- **1ファイルは概ね300行以内。** 超える場合は責務で分割する。
- **`research.html` は変更しない。**
- **Google Analytics のタグ（`G-HV9TNLE12M`）は既存ページから削除しない。**
- トップページの表示件数は `js/render-news.js` の `RECENT_NEWS_LIMIT = 10`。
- 移行の合格条件は「本文テキストの完全一致」。1文字でも欠けたら失敗とみなす。

---

## File Structure

| パス | 責務 |
|---|---|
| `tools/migrate_news.py` | `news.html` → `data/news.json`（一度きり） |
| `tools/migrate_cv.py` | `cv.html` → `data/cv.json`（一度きり） |
| `tools/verify_migration.py` | 移行の忠実性を機械検証（テスト本体） |
| `data/news.json` | ニュース記事の唯一の情報源 |
| `data/cv.json` | CVの唯一の情報源 |
| `js/i18n.js` | 言語判定と `ja`/`en` フォールバック（純粋関数） |
| `js/format.js` | 日付整形と年グループ化（純粋関数） |
| `js/render-news.js` | ニュースのDOM生成（一覧・トップ共用） |
| `js/render-cv.js` | CVのDOM生成 |
| `tools/tests/*.test.mjs` | `js/i18n.js` と `js/format.js` の単体テスト |
| `admin/index.html` | 管理画面の骨格 |
| `admin/admin.css` | 管理画面専用のスタイル |
| `admin/github-api.js` | GitHub Contents API の薄いラッパ |
| `admin/auth.js` | トークンの保存・検証・破棄 |
| `admin/app.js` | 画面遷移とタブ制御 |
| `admin/news-editor.js` | ニュース編集UI＋ライブプレビュー |
| `admin/cv-editor.js` | CV編集UI |
| `admin/media.js` | 画像アップロード |
| `robots.txt` | `admin/` と `plan/` と `tools/` を検索避け |

---

## Task 1: ニュースの移行と検証

移行は後続すべての土台になる。ここで1文字でも失うと、以降の作業がすべて誤ったデータの上に積み上がる。したがって検証スクリプトを先に書く。

**Files:**
- Create: `tools/verify_migration.py`
- Create: `tools/migrate_news.py`
- Create: `data/news.json`（スクリプトが生成）

**Interfaces:**
- Consumes: なし
- Produces: `data/news.json`。スキーマは設計書3.1節。後続タスクはこのファイルの構造に依存する。

- [ ] **Step 1: 検証スクリプトを書く（これが失敗するテスト）**

`tools/verify_migration.py` を作る。`news.html` と `data/news.json` を突き合わせ、失われた情報がないことを確認する。

```python
"""移行の忠実性を検証する。news.html と data/news.json を比較する。"""
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


def main() -> int:
    html = (ROOT / "news.html").read_text(encoding="utf-8")
    data = json.loads((ROOT / "data" / "news.json").read_text(encoding="utf-8"))
    items = data["items"]
    blocks = article_blocks(html)

    failures: list[str] = []

    if len(blocks) != len(items):
        failures.append(f"件数不一致: news.html={len(blocks)} news.json={len(items)}")

    for index, (block, item) in enumerate(zip(blocks, items)):
        label = f"[{index}] {item.get('date', '?')} {item['ja']['title'][:20]}"

        # 1. 可視テキストが完全に一致すること。
        #    タグは除く。日付とタグ名はJSONで構造化するため元HTMLから除外して比較する。
        block_body = re.sub(r'<div class="news-meta">.*?</div>', "", block, flags=re.S)
        want = visible_text(block_body)
        got = visible_text(json_article_html(item))
        if want != got:
            failures.append(f"{label}: 本文テキスト不一致\n  期待={want[:200]}\n  実際={got[:200]}")

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

    if failures:
        print(f"検証失敗: {len(failures)} 件\n")
        for f in failures:
            print(" -", f)
        return 1

    print(f"検証成功: {len(items)} 件の記事すべてでテキスト・リンク・画像が一致しました")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: 検証スクリプトを実行し、失敗することを確認する**

```bash
python tools/verify_migration.py
```

期待: `data/news.json` が存在しないため `FileNotFoundError` で異常終了する。これが「まだ実装がない」状態の証拠になる。

- [ ] **Step 3: 移行スクリプトを書く**

`tools/migrate_news.py` を作る。方針は以下の通り。

- `<article class="news-card">` 〜 `</article>` を切り出す（検証スクリプトと同じ `article_blocks` の考え方）。
- 各ブロックから `news-date`（`2026.09.16` 形式）→ `date`（`2026-09-16`）を取り出す。
- `news-tag` の中身 → `tag`。**表記揺れを正規化する**：`Publications`→`Publication`、`Awards`→`Award`、`NEWS`→`News`。正規化した件数を標準出力に報告する。
- `news-title` の中身 → `ja.title`。
- `news-body` の中身から、`<div class="news-image">` と `<div class="citation-box">` を取り除いた残りを `ja.body` とする。
- `news-image` 内の `<img>` から `src` / `alt` / `style` の幅を `image` に格納する。`style="width:75%"` → `"width": "75%"`。style がなければ `width` を省く。
- `citation-box` 内の `<p>` を `citations[].text`、`<a class="btn-sm">` を `citations[].links[]` とする。ひとつのボックスに `<p>` が複数ある場合は、直後に続く `<a>` をその `<p>` に紐づける。
- `citation-box` が `news-body` の外側にある記事が1件ある（2026.06.17 の受賞記事）。`news-body` の外も探索すること。
- `id` は `{date}-{タイトルから生成したスラッグ}`。日本語タイトルはスラッグ化できないため、`{date}-{連番}` を使う（例 `2026-09-16-1`）。
- `en` は `{"title": "", "body": ""}` で初期化する。
- `draft` は `false` 固定。
- `items` は元のHTMLの並び順（日付の新しい順）を保つ。

出力は `json.dump(..., ensure_ascii=False, indent=2)` とする。日本語をエスケープすると差分が読めなくなるため。

- [ ] **Step 4: 移行を実行し、検証が通ることを確認する**

```bash
python tools/migrate_news.py
python tools/verify_migration.py
```

期待: `検証成功: 37 件の記事すべてで…` と表示される。

失敗した場合は `migrate_news.py` を直す。**`verify_migration.py` の判定を緩めて通してはならない。** 検証を緩めることは、データを失ったまま先へ進むことと同じ。

- [ ] **Step 5: 目視で1件確認する**

```bash
python -c "import json;d=json.load(open('data/news.json',encoding='utf-8'));print(json.dumps(d['items'][3],ensure_ascii=False,indent=2))"
```

期待: 2026.06.17 の受賞記事。`image` に `image/SP_award_cut.JPG` と `width: 75%` が入り、`citations` が2件あること（この記事は引用が2つある唯一の例）。

- [ ] **Step 6: コミット**

```bash
git add tools/migrate_news.py tools/verify_migration.py data/news.json
git commit -m "feat: extract news articles from news.html into data/news.json"
```

---

## Task 2: CVの移行

**Files:**
- Create: `tools/migrate_cv.py`
- Create: `data/cv.json`
- Modify: `tools/verify_migration.py`（CV検証を追加）

**Interfaces:**
- Consumes: なし
- Produces: `data/cv.json`。スキーマは設計書3.2節。Task 5 が読む。

- [ ] **Step 1: CV検証を verify_migration.py に追加する**

`verify_cv()` 関数を追加し、`main()` から呼ぶ。検証内容：

- `cv.json` の `sections` が12件であること（`cv.html` の `<h2 class="cv-heading">` の数と一致）。
- 各セクションの `heading` が `cv.html` の見出しと順序どおり一致すること。見出しの前後空白は無視する（`Proceedings / unreviewed paper ` のように末尾に空白がある）。
- `cv.html` 全体の可視テキストと、`cv.json` の全エントリを連結した可視テキストが一致すること。ただし `cv.html` のナビゲーション・ヘッダ・フッタ・Contact 節は比較対象から除く。比較範囲は `<div class="container cv-container">` の中身に限定する。
- `cv.html` の `href` の集合が `cv.json` 側に含まれること。

- [ ] **Step 2: 検証を実行し、CV部分が失敗することを確認する**

```bash
python tools/verify_migration.py
```

期待: ニュースは成功、CVは `data/cv.json` が無いため失敗する。

- [ ] **Step 3: 移行スクリプトを書く**

`tools/migrate_cv.py` を作る。

- `<div class="container cv-container">` の中の `<section class="cv-section">` を順に切り出す。
- 最初のセクション（Profile）は特別扱い：`<p><strong>` → `profile.ja.name`、`<ul class="cv-profile-list">` の各 `<li>` → `profile.ja.lines[]`。`sections` には含めない。
- 残り11セクションについて、`<h2 class="cv-heading">` → `heading`（前後空白を除去）。
- 中身が `<div class="cv-grid">` なら `type: "dated"`。`cv-date` と `cv-content` を交互に読み、ペアにして `entries[]` に `{date, ja, en:""}` として格納する。`cv-content` の中身はHTMLのまま保持する（`<a>` を含むため）。
- 中身が `<ol class="publication-list">` または `<ol class="presentation-list">` なら `type: "numbered"`。各 `<li>` の中身をHTMLのまま `entries[]` に `{date:"", ja, en:""}` として格納する。`publication-list` と `presentation-list` の区別は `listClass` フィールドに保存する（`style.css` が両者を別々に整形しているため）。

**既知の不具合への対処**：Lectures セクション（`cv.html` 231〜243行目）は `<div class="cv-grid">` が閉じられていない。パーサはこれを許容し、`</section>` を境界として扱うこと。出力されるJSONでは正しい構造になる。

- [ ] **Step 4: 移行を実行し、検証が通ることを確認する**

```bash
python tools/migrate_cv.py
python tools/verify_migration.py
```

期待: ニュース37件・CV12セクションの両方で成功。

- [ ] **Step 5: Lectures セクションを目視確認する**

```bash
python -c "import json;d=json.load(open('data/cv.json',encoding='utf-8'));s=[x for x in d['sections'] if x['heading']=='Lectures'][0];print(json.dumps(s,ensure_ascii=False,indent=2))"
```

期待: `entries` が3件（2026.10-、2022.08.03、2019.12.13）。YouTubeリンクが2件目に含まれること。

- [ ] **Step 6: コミット**

```bash
git add tools/migrate_cv.py tools/verify_migration.py data/cv.json
git commit -m "feat: extract CV entries from cv.html into data/cv.json"
```

---

## Task 3: 純粋関数（日付整形・言語フォールバック・年グループ化）

DOMに触れない純粋関数を先に作り、`node --test` で固める。描画の正しさのうち、機械的に検証できる部分をここで押さえる。

**Files:**
- Create: `js/format.js`
- Create: `js/i18n.js`
- Create: `tools/tests/format.test.mjs`
- Create: `tools/tests/i18n.test.mjs`

**Interfaces:**
- Consumes: なし
- Produces:
  - `js/format.js`: `formatDotted(iso: string): string`、`formatJapanese(iso: string): string`、`groupByYear(items: Item[], oldestLabelYear: number): Group[]`
  - `js/i18n.js`: `currentLang(): "ja"|"en"`、`pick(obj: {ja: T, en: T}, lang: string): T`
  - `Group` は `{ id: string, label: string, items: Item[] }`

- [ ] **Step 1: 失敗するテストを書く**

`tools/tests/format.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDotted, formatJapanese, groupByYear } from "../../js/format.js";

test("formatDotted はゼロ埋めしたドット区切りを返す", () => {
  assert.equal(formatDotted("2026-09-16"), "2026.09.16");
  assert.equal(formatDotted("2026-06-22"), "2026.06.22");
});

test("formatJapanese はゼロ埋めしない和式を返す", () => {
  assert.equal(formatJapanese("2026-09-16"), "2026年9月16日");
  assert.equal(formatJapanese("2026-06-22"), "2026年6月22日");
  assert.equal(formatJapanese("2025-10-03"), "2025年10月3日");
});

test("不正な日付はそのまま返す（描画を止めないため）", () => {
  assert.equal(formatDotted("おかしな値"), "おかしな値");
  assert.equal(formatJapanese(""), "");
});

test("groupByYear は年ごとにまとめ、新しい順に並べる", () => {
  const items = [
    { date: "2026-09-16" },
    { date: "2026-01-02" },
    { date: "2024-05-01" },
  ];
  const groups = groupByYear(items, 2022);
  assert.deepEqual(groups.map((g) => g.label), ["2026年", "2024年"]);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].id, "year-2026");
});

test("groupByYear は指定年以前をひとつにまとめる", () => {
  const items = [
    { date: "2023-01-01" },
    { date: "2022-06-01" },
    { date: "2021-03-01" },
    { date: "2019-12-01" },
  ];
  const groups = groupByYear(items, 2022);
  assert.deepEqual(groups.map((g) => g.label), ["2023年", "2022年以前"]);
  assert.equal(groups[1].items.length, 3);
  assert.equal(groups[1].id, "year-2022");
});
```

`tools/tests/i18n.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { pick } from "../../js/i18n.js";

test("pick は指定言語の値を返す", () => {
  assert.equal(pick({ ja: "日本語", en: "English" }, "en"), "English");
  assert.equal(pick({ ja: "日本語", en: "English" }, "ja"), "日本語");
});

test("pick は英語が空なら日本語へフォールバックする", () => {
  assert.equal(pick({ ja: "日本語", en: "" }, "en"), "日本語");
  assert.equal(pick({ ja: "日本語", en: "   " }, "en"), "日本語");
  assert.equal(pick({ ja: "日本語" }, "en"), "日本語");
});

test("pick は日本語が無ければ空文字を返す（例外を投げない）", () => {
  assert.equal(pick({}, "ja"), "");
  assert.equal(pick(null, "ja"), "");
});
```

- [ ] **Step 2: テストを実行し、失敗することを確認する**

```bash
node --test tools/tests/
```

期待: `Cannot find module` で全件失敗。

- [ ] **Step 3: 実装する**

`js/format.js`:

```javascript
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDotted(iso) {
  const m = ISO_DATE.exec(iso ?? "");
  return m ? `${m[1]}.${m[2]}.${m[3]}` : (iso ?? "");
}

export function formatJapanese(iso) {
  const m = ISO_DATE.exec(iso ?? "");
  if (!m) return iso ?? "";
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

export function yearOf(iso) {
  const m = ISO_DATE.exec(iso ?? "");
  return m ? Number(m[1]) : 0;
}

/**
 * 記事を年ごとにまとめる。oldestLabelYear 以前はひとつのグループに集約する。
 * 戻り値は年の新しい順。
 */
export function groupByYear(items, oldestLabelYear) {
  const buckets = new Map();
  for (const item of items) {
    const year = yearOf(item.date);
    const key = year <= oldestLabelYear ? oldestLabelYear : year;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  return [...buckets.keys()]
    .sort((a, b) => b - a)
    .map((key) => ({
      id: `year-${key}`,
      label: key === oldestLabelYear ? `${key}年以前` : `${key}年`,
      items: buckets.get(key),
    }));
}
```

`js/i18n.js`:

```javascript
const STORAGE_KEY = "siteLang";
const SUPPORTED = ["ja", "en"];

/** ?lang=en → localStorage → 既定値 ja の順で決定する。 */
export function currentLang() {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (SUPPORTED.includes(q)) {
      localStorage.setItem(STORAGE_KEY, q);
      return q;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
  } catch {
    // プライベートブラウジング等で localStorage が使えない場合も描画は続ける。
  }
  return "ja";
}

/** 指定言語の値を返す。空なら日本語へフォールバックする。 */
export function pick(obj, lang) {
  if (!obj) return "";
  const value = obj[lang];
  if (typeof value === "string" && value.trim() !== "") return value;
  const ja = obj.ja;
  return typeof ja === "string" ? ja : "";
}
```

- [ ] **Step 4: テストを実行し、通ることを確認する**

```bash
node --test tools/tests/
```

期待: 全テスト pass。

- [ ] **Step 5: コミット**

```bash
git add js/format.js js/i18n.js tools/tests/
git commit -m "feat: add date formatting and language fallback helpers with tests"
```

---

## Task 4: ニュースの描画（news.html と index.html）

**Files:**
- Create: `js/render-news.js`
- Modify: `news.html`（記事本文を削除し、描画先の空コンテナに置き換える）
- Modify: `index.html`（`script.js` の読み込みをモジュールに差し替える）
- Delete: `script.js`（ベタ書き配列が不要になる）

**Interfaces:**
- Consumes: `js/format.js` の `formatDotted` / `formatJapanese` / `groupByYear`、`js/i18n.js` の `currentLang` / `pick`、`data/news.json`
- Produces:
  - `loadNews(): Promise<Item[]>` — `data/news.json` を取得し、`draft` を除いた配列を返す
  - `renderArchive(container: HTMLElement, items: Item[], lang: string): void`
  - `renderRecent(container: HTMLElement, items: Item[], lang: string): void`
  - `newsCardHtml(item: Item, lang: string): string` — 管理画面のプレビューが再利用する
  - 定数 `RECENT_NEWS_LIMIT = 10`

- [ ] **Step 1: `js/render-news.js` を書く**

要件：

- `newsCardHtml(item, lang)` は、既存の `news.html` と**同一のクラス構成**を返すこと。
  ```html
  <article class="news-card">
    <div class="news-meta"><span class="news-date">2026.09.16</span><span class="news-tag">Publication</span></div>
    <h3 class="news-title">タイトル</h3>
    <div class="news-body has-image">   <!-- has-image は画像がある時のみ -->
      <div class="news-image"><img src="…" alt="…" style="width:75%"></div>
      本文HTML
      <div class="citation-box">
        <p>引用テキスト</p>
        <a href="…" target="_blank" class="btn-sm">論文を見る →</a>
      </div>
    </div>
  </article>
  ```
  `→` は既存にあわせて `&rarr;` を使う。`style` は `image.width` がある時だけ出力する。
- `renderArchive` は `groupByYear(items, 2022)` でまとめ、各グループに `year-toggle` の見出しと `year-archive` のコンテナを出す。**先頭2グループは開いた状態**（`style.display: block`、`span` は `-`、見出しに `active` クラス）、それ以降は閉じる（`display: none`、`span` は `+`）。これは現行 `news.html` の状態（2026と2025が開、2024以前が閉）と一致する。
- トグルは `onclick` 属性ではなく `addEventListener` で付ける。
- `renderRecent` は先頭 `RECENT_NEWS_LIMIT` 件を `<li>{formatJapanese(date)} - {title}</li>` として出す。現行 `script.js` の表示形式と同じ。
- `loadNews` は `fetch("data/news.json", { cache: "no-cache" })` を使う。保存直後に古い内容が見えるのを防ぐため。
- 取得に失敗したら、コンテナに「ニュースを読み込めませんでした。時間をおいて再読み込みしてください。」と表示する。空白のページを見せないこと。

- [ ] **Step 2: `news.html` を書き換える**

37件の `<article>` と年トグル、末尾の `toggleYear` スクリプトをすべて削除し、以下に置き換える。ナビゲーション、ヘッダ、Contact、フッタ、Google Analytics タグはそのまま残す。

```html
    <section class="container news-container">
        <div id="news-archive"></div>
    </section>
```

`</body>` の直前：

```html
    <script type="module">
        import { loadNews, renderArchive } from "./js/render-news.js";
        import { currentLang } from "./js/i18n.js";
        loadNews().then((items) => {
            renderArchive(document.getElementById("news-archive"), items, currentLang());
        });
    </script>
```

- [ ] **Step 3: `index.html` を書き換える**

`<script src="script.js"></script>` を以下に置き換える。

```html
    <script type="module">
        import { loadNews, renderRecent } from "./js/render-news.js";
        import { currentLang } from "./js/i18n.js";
        loadNews().then((items) => {
            renderRecent(document.getElementById("recent-news"), items, currentLang());
        });
    </script>
```

`script.js` を削除する（`git rm script.js`）。

- [ ] **Step 4: ローカルサーバーで確認する**

```bash
python -m http.server 8000
```

ブラウザで確認する項目：

| URL | 確認内容 |
|---|---|
| `http://localhost:8000/news.html` | 記事が **37件**。2026年と2025年が開いており、2024年以前は閉じている。`+`/`-` のクリックで開閉する |
| 同上 | 画像付き3記事（PhD、SPring-8受賞、AIRAPT-29）で画像が表示される |
| 同上 | 2026.06.17 の受賞記事に引用ボックスが2件ある |
| 同上 | 引用ボックスの「論文を見る →」が新しいタブで正しいDOIへ飛ぶ |
| `http://localhost:8000/index.html` | Recent News が10件、`2026年9月16日 - 共著論文がGPLで出版されました` の形式 |

`git stash` で元のHTMLと見比べ、**レイアウトが崩れていないこと**を確認する。

- [ ] **Step 5: 件数を機械的に確認する**

ブラウザのコンソールで：

```javascript
document.querySelectorAll(".news-card").length   // → 37
document.querySelectorAll(".year-toggle").length // → 5
```

- [ ] **Step 6: コミット**

```bash
git add js/render-news.js news.html index.html
git rm script.js
git commit -m "feat: render news from data/news.json instead of hardcoded HTML"
```

---

## Task 5: CVの描画

**Files:**
- Create: `js/render-cv.js`
- Modify: `cv.html`

**Interfaces:**
- Consumes: `js/i18n.js` の `currentLang` / `pick`、`data/cv.json`
- Produces: `loadCv(): Promise<CvData>`、`renderCv(container: HTMLElement, data: CvData, lang: string): void`

- [ ] **Step 1: `js/render-cv.js` を書く**

- Profile セクションを先頭に出す（`<p><strong>{name}</strong></p>` ＋ `<ul class="cv-profile-list">`）。
- `type: "dated"` は `<div class="cv-grid">` の中に `<div class="cv-date">` と `<div class="cv-content">` を交互に出す。
- `type: "numbered"` は `<ol class="{listClass}" reversed>` の中に `<li>` を出す。`listClass` は `publication-list` か `presentation-list`。
- エントリ本文は `pick(entry, lang)` を通す。
- 取得失敗時は「CVを読み込めませんでした。」と表示する。

- [ ] **Step 2: `cv.html` を書き換える**

`<div class="container cv-container">` の中身をすべて削除し、`<div class="container cv-container" id="cv-root"></div>` にする。`</body>` 直前にモジュールスクリプトを追加する。

```html
    <script type="module">
        import { loadCv, renderCv } from "./js/render-cv.js";
        import { currentLang } from "./js/i18n.js";
        loadCv().then((data) => {
            renderCv(document.getElementById("cv-root"), data, currentLang());
        });
    </script>
```

- [ ] **Step 3: ローカルサーバーで確認する**

`http://localhost:8000/cv.html` で確認する項目：

- セクションが12個（Profile を含む）、順序が元と同じ
- Publications が8件、番号が `reversed` で降順
- **Lectures セクションが崩れていない**（元HTMLでは `div` の閉じ忘れにより後続が巻き込まれていた）
- `[DOI]` `[PDF]` `[Video]` のリンクが機能する

コンソールで：

```javascript
document.querySelectorAll(".cv-section").length  // → 12
document.querySelectorAll(".publication-list > li").length // → 11 (Publications 8 + Proceedings 3)
```

- [ ] **Step 4: コミット**

```bash
git add js/render-cv.js cv.html
git commit -m "feat: render CV from data/cv.json instead of hardcoded HTML"
```

---

## Task 6: 管理画面の土台（認証とGitHub API）

ここから管理画面。まず「開く・ログインする・ファイルを読む」までを動く状態にする。編集機能はまだ載せない。

**Files:**
- Create: `admin/github-api.js`
- Create: `admin/auth.js`
- Create: `admin/index.html`
- Create: `admin/admin.css`
- Create: `admin/app.js`
- Create: `robots.txt`

**Interfaces:**
- Consumes: なし
- Produces:
  - `github-api.js`: `class GitHubApi { constructor(token); getFile(path): Promise<{text, sha}>; putFile(path, text, sha, message): Promise<{commitUrl, sha}>; putBinary(path, base64, message): Promise<{commitUrl, sha}>; getRepo(): Promise<{canPush, tokenExpiry}> }`
  - `auth.js`: `saveToken(token, remember): void`、`loadToken(): string|null`、`clearToken(): void`、`validate(token): Promise<{ok, reason, canPush, tokenExpiry}>`

- [ ] **Step 1: `admin/github-api.js` を書く**

**最重要点：日本語を含むため base64 変換に素の `btoa()` を使ってはならない。** 以下を使う。

```javascript
const OWNER = "FSakai1997";
const REPO = "fumiyasakai.github.io";
const BRANCH = "main";
const API = "https://api.github.com";

export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function decodeBase64(b64) {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
```

`GitHubApi` クラスの要件：

- すべてのリクエストに `Authorization: Bearer <token>`、`Accept: application/vnd.github+json`、`X-GitHub-Api-Version: 2022-11-28` を付ける。
- `getFile(path)` は `GET /repos/{OWNER}/{REPO}/contents/{path}?ref={BRANCH}` を `cache: "no-store"` で呼び、`{ text: decodeBase64(json.content), sha: json.sha }` を返す。404 の場合は `{ text: null, sha: null }` を返す（新規ファイル作成に対応するため）。
- `putFile(path, text, sha, message)` は `PUT` で `{ message, content: encodeBase64(text), sha, branch: BRANCH }` を送る。`sha` が `null` なら省略する。
- **409 と 422 は競合として扱う。** `throw new ConflictError("別の場所からこのファイルが更新されています。再読み込みしてください。")` とする。ほかのエラーはステータスとGitHubのメッセージを含めて投げる。
- `getRepo()` は `GET /repos/{OWNER}/{REPO}` を呼び、`{ canPush: json.permissions?.push === true, tokenExpiry: response.headers.get("github-authentication-token-expiration") }` を返す。

- [ ] **Step 2: `admin/auth.js` を書く**

- `saveToken(token, remember)`: `remember` が真なら `localStorage`、偽なら `sessionStorage` に `gh_token` として保存する。保存先を `gh_token_store` に記録し、`loadToken` / `clearToken` が両方を見るようにする。
- `validate(token)`: `new GitHubApi(token).getRepo()` を試す。結果を次のように分類し、**利用者が何をすればよいか分かる文言**を返す。

  | 状況 | 返す `reason` |
  |---|---|
  | 401 | `トークンが無効か、有効期限が切れています。GitHubで新しいトークンを発行してください。` |
  | 404 | `このトークンはリポジトリ fumiyasakai.github.io にアクセスできません。トークン発行時に対象リポジトリの選択を確認してください。` |
  | 200 だが `canPush` が偽 | `トークンに書き込み権限がありません。Contents を「Read and write」にして再発行してください。` |
  | 200 かつ `canPush` | `ok: true` |
  | ネットワーク失敗 | `GitHubに接続できませんでした。通信環境を確認してください。` |

- [ ] **Step 3: `admin/index.html` と `admin/admin.css` を書く**

`index.html` の要件：

- `<meta name="robots" content="noindex,nofollow">` を `<head>` に入れる。
- **Google Analytics タグは入れない**（管理操作を計測する理由がない）。
- ログイン画面（`#login-view`）と編集画面（`#editor-view`）を持ち、片方だけ表示する。
- ログイン画面に**トークンの発行手順**を書く。外部の文書を見に行かずに済むようにする。
  1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token
  2. Repository access: Only select repositories → `fumiyasakai.github.io`
  3. Permissions → Repository permissions → Contents → **Read and write**
  4. Expiration: 1年
  5. 生成された `github_pat_…` をここに貼る
- 共用PCに関する注意書きを、チェックボックスのすぐ隣に置く。
- 編集画面にタブ（`ニュース` / `CV` / `画像`）とログアウトボタン、トークン残日数の表示。

`admin.css` は `style.css` を読み込まず独立させる。管理画面のUIが公開サイトのスタイルに引きずられると、プレビューの見え方が狂うため。**プレビュー領域だけは `<iframe>` にして、その中で `style.css` を読み込む。**

- [ ] **Step 4: `admin/app.js` を書く**

- 起動時に `loadToken()` を試し、あればそのまま `validate` して編集画面へ。無ければログイン画面。
- ログインボタンで `validate` → 成功なら `saveToken` して編集画面へ。失敗なら `reason` を赤字で表示する。
- ログアウトで `clearToken()` して再読み込み。
- トークン残日数が30日未満なら警告帯を出す。
- タブ切替は、この時点では見出しだけ切り替わればよい（中身は Task 7〜9 で入れる）。

- [ ] **Step 5: `robots.txt` を作る**

```
User-agent: *
Disallow: /admin/
Disallow: /plan/
Disallow: /tools/
```

- [ ] **Step 6: 認証の3パターンを実際に試す**

ローカルサーバー（`http://localhost:8000/admin/`）で確認する。

| 入力 | 期待される表示 |
|---|---|
| でたらめな文字列 | `トークンが無効か、有効期限が切れています。…` |
| 他リポジトリ用のトークン（あれば） | `このトークンはリポジトリ … にアクセスできません。…` |
| 正規のトークン | 編集画面に遷移し、残日数が表示される |

正規トークンで、コンソールから読み取りを確認する：

```javascript
// admin/app.js が window.api にインスタンスを置いている前提（デバッグ用）
const f = await window.api.getFile("data/news.json");
JSON.parse(f.text).items.length   // → 37
f.sha                              // → 40文字の文字列
```

- [ ] **Step 7: コミット**

```bash
git add admin/ robots.txt
git commit -m "feat: add admin shell with GitHub token authentication"
```

---

## Task 7: ニュース編集UIとライブプレビュー

**Files:**
- Create: `admin/news-editor.js`
- Modify: `admin/app.js`（ニュースタブに接続する）
- Modify: `admin/index.html`（ニュースタブの骨格を追加）

**Interfaces:**
- Consumes: `admin/github-api.js` の `GitHubApi`、`js/render-news.js` の `newsCardHtml`
- Produces: `initNewsEditor(container: HTMLElement, api: GitHubApi): Promise<void>`

- [ ] **Step 1: 一覧と編集フォームを作る**

- 起動時に `api.getFile("data/news.json")` で読み、`sha` を保持する。
- 一覧：日付、タグ、タイトル、下書きバッジ。行ごとに `編集` `複製` `削除` `↑` `↓`。
- `新規作成`：今日の日付、タグ `News`、空のタイトルと本文で新しい項目を先頭に追加し、編集フォームを開く。`id` は `{今日の日付}-{ランダム4文字}`。
- 編集フォームの項目：
  - 日付（`<input type="date">`）
  - タグ（`<input list="tag-options">` で候補を出しつつ自由入力も許す。候補は既存データから重複を除いて生成する）
  - タイトル：日本語／English の切替タブ
  - 本文：`<textarea>`（HTML直接編集）。`<p>段落</p>` `<i>斜体</i>` `<strong>太字</strong>` `<br>` `<a href="">リンク</a>` の早見表をフォームの下に置く
  - 画像：`src` / `alt` / `width`。`画像タブから選ぶ` ボタン
  - 引用ボックス：可変個数。各々に本文と、複数のリンク（ラベル＋URL）
  - 下書きチェックボックス

- [ ] **Step 2: ライブプレビューを作る**

右側に `<iframe>` を置き、その中で `style.css` を読み込む。編集内容が変わるたび（`input` イベント、200msのデバウンス）、`newsCardHtml(item, "ja")` の結果を iframe に流し込む。

**`js/render-news.js` の `newsCardHtml` をそのまま再利用すること。** 管理画面用に描画コードを書き直してはならない。書き直すと、プレビューと本番が時間とともに食い違っていく。

- [ ] **Step 3: 保存処理を作る**

- `保存` ボタン押下で、`JSON.stringify(data, null, 2)` を `api.putFile("data/news.json", text, sha, message)` に渡す。
- 保存前の確認ダイアログに **`37件 → 38件` のように件数の変化**を表示する。減少する場合は「{n}件減ります。よろしいですか」と明示する。
- 成功したら新しい `sha` を保持し、コミットへのリンクと「1〜2分で公開に反映されます」を表示する。
- `ConflictError` なら上書きせず、「別の場所から更新されています。再読み込みしてください」と、再読み込みボタンを出す。
- 未保存の変更がある状態で `beforeunload` が発生したら警告する。

- [ ] **Step 4: 実際に一往復させる**

**本番リポジトリに対して行う。** 以下を順に実施し、各段階を確認する。

1. `http://localhost:8000/admin/` を開きログインする
2. `新規作成` でテスト記事（タイトル `テスト投稿`、本文 `<p>これはテストです。</p>`）を作る
3. プレビューが公開ページと同じ見た目になっていることを確認する
4. `保存` → 確認ダイアログに `37件 → 38件` と出ることを確認する
5. 保存後、GitHub のコミット一覧に現れることを確認する
6. 1〜2分待ち、`https://fumiyasakai.github.io/news.html` にテスト記事が出ることを確認する
7. `https://fumiyasakai.github.io/index.html` の Recent News 先頭にも出ることを確認する
8. 管理画面でテスト記事を削除 → `38件 → 37件`（1件減ります、の警告が出ること）→ 保存
9. 公開ページから消えることを確認する

この往復が通らない限り、Task 8 に進まない。

- [ ] **Step 5: 競合検知を試す**

管理画面を開いたまま、GitHub のWeb UI で `data/news.json` を直接1文字編集してコミットする。管理画面で `保存` を押し、**上書きされず警告が出る**ことを確認する。

- [ ] **Step 6: コミット**

```bash
git add admin/news-editor.js admin/app.js admin/index.html
git commit -m "feat: add news editor with live preview and conflict detection"
```

---

## Task 8: 画像アップロード

**Files:**
- Create: `admin/media.js`
- Modify: `admin/app.js`、`admin/index.html`

**Interfaces:**
- Consumes: `admin/github-api.js` の `GitHubApi.putBinary`
- Produces: `initMedia(container, api): Promise<void>`、`pickImage(api): Promise<string>`（ニュース編集から呼ぶ、選択されたパスを返す）

- [ ] **Step 1: 一覧とアップロードを作る**

- `GET /repos/{owner}/{repo}/contents/image` で既存画像を一覧し、サムネイルで並べる。
- ファイル選択 → `FileReader.readAsDataURL` → `,` 以降の base64 を取り出す → `putBinary("image/" + 安全なファイル名, base64, message)`。
- ファイル名は英数字・ハイフン・アンダースコア・ピリオドのみに正規化する。日本語ファイル名はそのままだとURLで扱いにくいため。
- **5MBを超えるファイルは拒否する**（GitHub Contents API の実用上限、およびリポジトリ肥大化の防止）。「{n}MBあります。5MB以下に縮小してください」と表示する。
- 既存と同名のファイルは上書き確認を出す。
- アップロード後、`image/xxx.jpg` のパスをコピーできるようにする。

- [ ] **Step 2: ニュース編集から呼べるようにする**

ニュース編集フォームの `画像タブから選ぶ` ボタンで一覧をモーダル表示し、選択したパスを `image.src` に入れる。

- [ ] **Step 3: 実際に試す**

1. 小さい画像（100KB程度）をアップロードする
2. `image/` に現れることを GitHub 上で確認する
3. テスト記事にその画像を指定し、プレビューに表示されることを確認する
4. 6MBの画像を選び、拒否メッセージが出ることを確認する
5. テスト記事を削除し、アップロードした画像も GitHub 上から削除する

- [ ] **Step 4: コミット**

```bash
git add admin/media.js admin/app.js admin/index.html
git commit -m "feat: add image upload to admin"
```

---

## Task 9: CV編集UI

**Files:**
- Create: `admin/cv-editor.js`
- Modify: `admin/app.js`、`admin/index.html`

**Interfaces:**
- Consumes: `admin/github-api.js` の `GitHubApi`、`js/render-cv.js` の描画関数
- Produces: `initCvEditor(container, api): Promise<void>`

- [ ] **Step 1: セクション選択とエントリ編集を作る**

- `api.getFile("data/cv.json")` で読み、`sha` を保持する。
- 左にセクション一覧（12件）、右に選択セクションのエントリ一覧。
- `type: "dated"` は `日付` と `内容` の2列で編集する。
- `type: "numbered"` は `内容` のみ（日付欄を出さない）。
- 各エントリに `↑` `↓` `削除`、末尾に `追加`。
- Profile セクションは名前と箇条書き行の編集。
- 内容欄は `<textarea>`（`<a>` `<strong>` `<i>` を含むため）。
- 保存は Task 7 と同じ仕組み（件数確認、競合検知、コミットリンク）。

**セクションの追加・削除・並べ替えは作らない。** CVの章立てはめったに変わらず、UIを作る労力に見合わない。必要になったら `data/cv.json` を直接編集すればよい。

- [ ] **Step 2: プレビューを作る**

ニュースと同じく `<iframe>` に `js/render-cv.js` の出力を流し込む。

- [ ] **Step 3: 実際に一往復させる**

1. Awards セクションにテスト項目（`2026.09` / `テスト受賞`）を追加する
2. 保存し、公開 `cv.html` に反映されることを確認する
3. 削除して保存し、消えることを確認する
4. Publications の並べ替え（`↑`）を試し、公開ページの番号が正しく振り直されることを確認する

- [ ] **Step 4: コミット**

```bash
git add admin/cv-editor.js admin/app.js admin/index.html
git commit -m "feat: add CV editor to admin"
```

---

## Task 10: 仕上げと全体検証

**Files:**
- Modify: `admin/index.html`（使い方の記載を最終化）
- Create: `plan/運用手順.md`

**Interfaces:**
- Consumes: すべて
- Produces: なし

- [ ] **Step 1: 全テストを走らせる**

```bash
python tools/verify_migration.py
node --test tools/tests/
```

期待: 両方とも成功。移行の忠実性が、ここまでの改修で壊れていないことを確認する。

- [ ] **Step 2: 公開サイトで全ページを確認する**

| ページ | 確認内容 |
|---|---|
| `/` | Recent News 10件、レイアウトが改修前と同じ |
| `/news.html` | 37件、年トグルの開閉、画像3件、引用リンク |
| `/cv.html` | 12セクション、Lectures が崩れていない |
| `/research.html` | **変更していないこと**（表示が改修前と同一） |
| `/notes/SG.html` | 変更していないこと |
| `/?lang=en` | `en` が空なので日本語が表示される（フォールバックの確認） |

スマートフォンでも `/news.html` と `/admin/` を開き、操作できることを確認する。

- [ ] **Step 3: 運用手順を書く**

`plan/運用手順.md` に、利用者向けの手順をまとめる。

- トークンの発行手順（画面の順序どおり）
- 記事の追加・編集・削除の手順
- 本文で使えるHTMLタグの早見表
- 公開反映までの待ち時間（1〜2分）
- **間違えた時の戻し方**：GitHub のコミット一覧 → 該当コミット → `Revert`
- トークンの期限が切れた時の再発行手順
- トークンを失効させたい時（GitHub → Settings → Developer settings → 該当トークン → Delete）

- [ ] **Step 4: コミット**

```bash
git add admin/index.html plan/
git commit -m "docs: add operation guide for the admin interface"
```

- [ ] **Step 5: 利用者に引き渡す**

以下を伝える。

- 管理画面のURL
- トークン発行の手順
- `plan/` `tools/` もGitHub Pagesで公開されている（`robots.txt` で検索避け済み、秘密情報なし）。不要なら削除してよい
- 英語版を作る時は、`data/*.json` の `en` を埋め、英語ページを追加するだけでよい。データ構造とレンダラは変更不要

---

## Self-Review

**仕様の網羅**

| 設計書の節 | 対応タスク |
|---|---|
| 3.1 news.json | Task 1 |
| 3.2 cv.json | Task 2 |
| 3.3 言語の扱い | Task 3 |
| 4 ファイル構成 | Task 1〜9 |
| 5.1 画面の流れ | Task 6, 7, 8, 9 |
| 5.2 保存処理 | Task 7 Step 3 |
| 5.3 事故防止 | Task 7 Step 3（件数確認・競合・未保存警告） |
| 6 セキュリティ | Task 6 Step 3, 5 |
| 7 移行 | Task 1, 2 |
| 8 検証計画 | Task 4 Step 4, 5 / Task 5 Step 3 / Task 6 Step 6 / Task 7 Step 4, 5 / Task 8 Step 3 / Task 9 Step 3 / Task 10 Step 1, 2 |
| 9 運用手順 | Task 10 Step 3 |

漏れなし。

**型の整合**

- `newsCardHtml(item, lang)` は Task 4 で定義、Task 7 で利用。名前一致。
- `pick(obj, lang)` は Task 3 で定義、Task 4・5 で利用。名前一致。
- `groupByYear(items, oldestLabelYear)` は Task 3 で定義、Task 4 で `groupByYear(items, 2022)` として利用。引数一致。
- `GitHubApi.getFile/putFile/putBinary/getRepo` は Task 6 で定義、Task 7・8・9 で利用。名前一致。
- `ConflictError` は Task 6 Step 1 で定義、Task 7 Step 3 で捕捉。

**プレースホルダ**

なし。
