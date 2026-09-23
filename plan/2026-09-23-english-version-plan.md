# 英語版ページ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HOME / NEWS / RESEARCH / CV の英語版を `/en/` に用意し、翻訳を管理画面から少しずつ進められるようにする。

**Architecture:** 記事データ（`data/*.json`）は日英で共用し、英語ページは同じデータを `lang="en"` で描画する。英語が空の項目は日本語にフォールバックする。ページの骨組み（ナビ・見出し・連絡先）は各HTMLに直接書く。研究紹介は新たにデータ化し、管理画面に RESEARCH タブを足す。

**Tech Stack:** 素のHTML / CSS / ES モジュール（依存パッケージなし）、移行スクリプトは Python 3.12 標準ライブラリのみ、テストは Node 24 組み込みの `node --test`。

**Spec:** `plan/2026-09-23-english-version-design.md`

## Global Constraints

- **公開URL:** `https://FSakai1997.github.io/fumiyasakai.github.io/`（プロジェクトページ形式）
- **絶対パスのリンクを書いてはならない。** `/news.html` は配信先の都合で壊れる。ページ間リンクは必ず相対パス（`en/news.html`、`../news.html`）。例外は `hreflang` のみで、そこは完全なURLを書く。
- **依存パッケージの追加は禁止。**
- **`style.css` は変更しない。** 既存クラス（`research-topic`, `research-topic reverse`, `research-text`, `research-image`, `img-caption`, `research-divider`）に完全一致するHTMLを生成すること。
- **1ファイルは概ね300行以内。**
- **`sh tools/check.sh` が常に通ること。** 現在79件。減らしてはならない。
- 移行の合格条件は「本文テキストの完全一致」。1文字でも欠けたら失敗とみなす。
- Google Analytics タグ（`G-HV9TNLE12M`）は日本語ページから削除しない。**英語ページにも同じタグを入れる。**

---

## File Structure

| パス | 責務 |
|---|---|
| `tools/fixtures/research.original.html.txt` | 移行前の research.html（検証の比較元） |
| `tools/migrate_research.py` | `research.html` → `data/research.json` |
| `data/research.json` | 研究紹介の唯一の情報源 |
| `js/render-research.js` | 研究紹介のHTML生成（公開ページとプレビューで共用） |
| `js/i18n.js` | `currentLang` を削除、`countUntranslated` を追加 |
| `js/render-news.js` | データ参照先をモジュール基準に変更 |
| `js/render-cv.js` | 同上 |
| `en/index.html` `en/news.html` `en/research.html` `en/cv.html` | 英語ページ |
| `index.html` `news.html` `research.html` `cv.html` | ENリンク・hreflang を追加 |
| `admin/research-form.js` | 研究テーマ1件分の編集フォーム |
| `admin/research-editor.js` | RESEARCHタブの一覧・保存 |
| `admin/app.js` `admin/index.html` | RESEARCHタブを足す |
| `tools/tests/render-research.test.mjs` | 研究紹介の描画 |
| `tools/tests/pages.test.mjs` | 8ページの相互リンク・lang・hreflang |
| `tools/tests/i18n.test.mjs` | `countUntranslated` を追加 |
| `tools/tests/editor-render.test.mjs` | 研究フォームの描画を追加 |

---

## Task 1: 研究紹介の移行

**Files:**
- Create: `tools/fixtures/research.original.html.txt`
- Create: `tools/migrate_research.py`
- Create: `data/research.json`
- Modify: `tools/verify_migration.py`

**Interfaces:**
- Consumes: なし
- Produces: `data/research.json`。スキーマは設計書6節。Task 2 以降が読む。

- [ ] **Step 1: 移行前HTMLを固定保存し、検証を先に書く**

```bash
cp research.html tools/fixtures/research.original.html.txt
```

`tools/verify_migration.py` に `verify_research()` を追加し、`main()` から呼ぶ。検証内容：

- `topics` が 2 件であること（`<section class="research-topic...">` の数と一致）
- 各トピックの `heading.ja` の可視テキストが、元の `<h2>` の可視テキストと一致すること
- `<div class="container">` から `<section id="contact"` までの可視テキストが、`heading.ja` + `body.ja` + `image.caption.ja` を連結したものと一致すること
- 元の `href` の集合が失われていないこと
- 元の `<img src>` がすべて `image.src` に存在すること

既存の `visible_text` / `hrefs` / `img_srcs` / `first_difference` をそのまま使う。

- [ ] **Step 2: 検証を実行し、失敗することを確認する**

```bash
sh tools/check.sh
```

期待：`data/research.json` が無いため `FileNotFoundError` で異常終了。

- [ ] **Step 3: 移行スクリプトを書く**

`tools/migrate_research.py` を作る。既存の `migrate_news.py` の `extract_div` / `attr` / `tidy` と同じ考え方を使う。

- `<div class="container">` から `<section id="contact"` までを対象範囲にする
- `<section class="research-topic...">` 〜 `</section>` を切り出す（`reverse` が付く場合がある）
- `research-text` の中の `<h2>…</h2>` → `heading.ja`。**`<br>` を含むためHTMLのまま保持する**
- `research-text` の中の `<h2>` を除いた残り → `body.ja`
- `research-image` の中の `<img>` から `src` / `alt` → `image`
- `research-image` の中の `<div class="img-caption">…</div>` → `image.caption.ja`
- `id` は見出しから作れないため（日本語）、`topic-1` `topic-2` のような連番にする
- `en` はすべて空文字列で初期化する
- **`reverse` クラスは保存しない。** 描画時に奇数・偶数で自動的に付ける（Task 2）。テーマを増やしたときに自動で左右が揃う

出力は `json.dump(..., ensure_ascii=False, indent=2)`。

- [ ] **Step 4: 移行を実行し、検証が通ることを確認する**

```bash
PYTHONIOENCODING=utf-8 python tools/migrate_research.py
sh tools/check.sh
```

期待：`検証成功: 研究紹介 2 テーマ…` が出て、既存79件も通ったまま。

失敗したら `migrate_research.py` を直す。**`verify_migration.py` の判定を緩めて通してはならない。**

- [ ] **Step 5: 中身を目視確認する**

```bash
PYTHONIOENCODING=utf-8 python -c "import json;d=json.load(open('data/research.json',encoding='utf-8'));print(json.dumps(d,ensure_ascii=False,indent=2)[:1500])"
```

期待：`heading.ja` に `<br>` が残っている。`image.caption.ja` に「高圧実験による地球深部物質の探査」が入っている。

- [ ] **Step 6: コミット**

```bash
git add tools/migrate_research.py tools/verify_migration.py tools/fixtures/research.original.html.txt data/research.json
git commit -m "feat: extract research topics from research.html into data/research.json"
```

---

## Task 2: 研究紹介の描画と、データ参照先の修正

英語ページから読めるようにするため、3つのレンダラのデータ参照先をまとめて直す。ここを直さないと `/en/` で必ず404になる。

**Files:**
- Create: `js/render-research.js`
- Modify: `js/render-news.js`、`js/render-cv.js`（データ参照先）
- Modify: `research.html`
- Create: `tools/tests/render-research.test.mjs`

**Interfaces:**
- Consumes: `js/i18n.js` の `pick`、`data/research.json`
- Produces:
  - `researchHtml(data: ResearchData, lang: string): string` — 管理画面のプレビューが再利用する
  - `loadResearch(): Promise<ResearchData>`
  - `mountResearch(container: HTMLElement, lang: string): Promise<void>`

- [ ] **Step 1: 失敗するテストを書く**

`tools/tests/render-research.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { researchHtml } from "../../js/render-research.js";

const data = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../data/research.json", import.meta.url)), "utf-8"),
);
const html = researchHtml(data, "ja");

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test("研究テーマ2件を描画する", () => {
  assert.equal(count(html, '<section class="research-topic'), 2);
});

test("2件目は reverse が付き、画像が反対側に出る", () => {
  assert.equal(count(html, '<section class="research-topic">'), 1);
  assert.equal(count(html, '<section class="research-topic reverse">'), 1);
});

test("テーマの間に区切り線が入る", () => {
  assert.equal(count(html, '<hr class="research-divider">'), 1);
});

test("見出しの <br> は保たれる", () => {
  assert.ok(html.includes("<br>"), "見出しの改行が失われている");
});

test("画像とキャプションが描画される", () => {
  assert.ok(html.includes('src="image/Earth.jpg"'));
  assert.ok(html.includes('<div class="img-caption">高圧実験による地球深部物質の探査</div>'));
});

test("開きタグと閉じタグの数が合う", () => {
  assert.equal(count(html, "<div "), count(html, "</div>"));
  assert.equal(count(html, "<section "), count(html, "</section>"));
});

test("英語が未入力なら日本語を表示する", () => {
  const englishHtml = researchHtml(data, "en");
  assert.ok(englishHtml.includes("地球コアの組成決定"));
});

test("英語が入っていれば英語を表示する", () => {
  const translated = structuredClone(data);
  translated.topics[0].heading.en = "Composition of the Earth's core";
  translated.topics[0].body.en = "<p>English body.</p>";
  const englishHtml = researchHtml(translated, "en");
  assert.ok(englishHtml.includes("Composition of the Earth&#x27;s core") || englishHtml.includes("Composition of the Earth's core"));
  assert.ok(englishHtml.includes("English body."));
  assert.ok(!englishHtml.includes("地球コアの組成決定"));
});
```

- [ ] **Step 2: テストを実行し、失敗することを確認する**

```bash
node --test tools/tests/render-research.test.mjs
```

期待：`Cannot find module` で失敗。

- [ ] **Step 3: `js/render-research.js` を書く**

要件：

- `researchHtml(data, lang)` が以下と同じクラス構成を返す。偶数番目（0始まりで奇数）のテーマに `reverse` を付ける。

```html
<section class="research-topic">
    <div class="research-text">
        <h2>見出し（HTMLのまま）</h2>
        本文HTML
    </div>
    <div class="research-image">
        <img src="image/Earth.jpg" alt="…" onerror="this.style.display='none'">
        <div class="img-caption">キャプション</div>
    </div>
</section>
<hr class="research-divider">
<section class="research-topic reverse">
    …
</section>
```

- `<hr class="research-divider">` はテーマの**間**にだけ入れる（最後のテーマの後ろには入れない）
- `onerror="this.style.display='none'"` は移行前のHTMLにあったので残す
- `heading` と `body` と `caption` は `pick()` を通す。`caption` は `{ja, en}` の形なので `pick(image.caption, lang)`
- `alt` と `src` は属性としてエスケープする
- 取得失敗時は「研究内容を読み込めませんでした。」と表示する

- [ ] **Step 4: 3つのレンダラのデータ参照先をモジュール基準にする**

`js/render-news.js`、`js/render-cv.js`、`js/render-research.js` の定数を、いずれも次の形にする。

```javascript
// ページからの相対パスにすると /en/ 配下から呼んだときに壊れる。
// このモジュールは常に /js/ にあるので、モジュール基準で解決する。
const DATA_URL = new URL("../data/news.json", import.meta.url);
```

- [ ] **Step 5: `research.html` を書き換える**

`<div class="container">` から最後の `</div>` までを `<div class="container" id="research-root"></div>` に置き換える。ナビ、page-header、Contact、フッタ、Google Analytics はそのまま残す。

`</body>` の直前：

```html
    <script type="module">
        import { mountResearch } from "./js/render-research.js";
        mountResearch(document.getElementById("research-root"), "ja");
    </script>
```

- [ ] **Step 6: テストとローカル確認**

```bash
node --test tools/tests/render-research.test.mjs
sh tools/check.sh
python -m http.server 8000
```

`http://localhost:8000/research.html` を開き、**改修前と見た目が同じ**こと（2テーマ、画像が左右交互、区切り線）を確認する。

```javascript
document.querySelectorAll(".research-topic").length        // → 2
document.querySelectorAll(".research-topic.reverse").length // → 1
```

- [ ] **Step 7: 他のページが壊れていないことを確認する**

`http://localhost:8000/news.html` と `/cv.html` を開く。**Step 4 でデータ参照先を変えたので、ここで記事が出なければ変更が誤っている。**

- [ ] **Step 8: コミット**

```bash
git add js/render-research.js js/render-news.js js/render-cv.js research.html tools/tests/render-research.test.mjs
git commit -m "feat: render research page from data/research.json"
```

---

## Task 3: 言語の扱いを整理する

**Files:**
- Modify: `js/i18n.js`
- Modify: `tools/tests/i18n.test.mjs`
- Modify: `index.html`、`news.html`、`cv.html`、`research.html`（言語を明示）

**Interfaces:**
- Consumes: なし
- Produces: `countUntranslated(items, lang, fields): number`。`pick` / `pickTitle` / `pickBody` は変更なし。`currentLang` は**削除**。

- [ ] **Step 1: 失敗するテストを書く**

`tools/tests/i18n.test.mjs` に追記する。

```javascript
import { countUntranslated } from "../../js/i18n.js";

test("countUntranslated は英語が空の項目を数える", () => {
  const items = [
    { ja: { title: "あ", body: "<p>い</p>" }, en: { title: "A", body: "<p>B</p>" } },
    { ja: { title: "う", body: "<p>え</p>" }, en: { title: "", body: "" } },
    { ja: { title: "お", body: "<p>か</p>" }, en: { title: "C", body: "" } },
  ];
  assert.equal(countUntranslated(items, "en"), 2);
});

test("countUntranslated は日本語表示では常に0を返す", () => {
  const items = [{ ja: { title: "あ", body: "" }, en: { title: "", body: "" } }];
  assert.equal(countUntranslated(items, "ja"), 0);
});

test("countUntranslated は空配列で0を返す", () => {
  assert.equal(countUntranslated([], "en"), 0);
});

test("currentLang は削除されている", async () => {
  const module = await import("../../js/i18n.js");
  assert.equal(module.currentLang, undefined, "URLで言語が決まるため、この関数は残してはならない");
});
```

既存の `currentLang` を使うテストがあれば削除する。

- [ ] **Step 2: テストを実行し、失敗することを確認する**

```bash
node --test tools/tests/i18n.test.mjs
```

期待：`countUntranslated is not a function` と `currentLang は削除されている` の失敗。

- [ ] **Step 3: `js/i18n.js` を書き換える**

`currentLang`、`STORAGE_KEY`、`SUPPORTED`、`DEFAULT_LANG` を削除する。ファイル冒頭のコメントを「言語はURLで決まる。`/` が日本語、`/en/` が英語。各ページが自分の言語を定数で渡す」に書き換える。

`countUntranslated` を追加する。

```javascript
/**
 * 指定言語での未翻訳の件数。
 * 英語ページで日本語にフォールバックしている項目がいくつあるかを数える。
 * 0 になれば、その旨の案内は自動的に消える。
 */
export function countUntranslated(items, lang) {
  if (lang === "ja") return 0;
  return items.filter((item) => {
    const box = item[lang];
    const title = box?.title?.trim();
    const body = box?.body?.trim();
    return !title || !body;
  }).length;
}
```

- [ ] **Step 4: 日本語4ページで言語を明示する**

各ページのモジュールスクリプトから `currentLang` の import を外し、`"ja"` を直接渡す。

```html
<script type="module">
    import { mountNews, renderArchive } from "./js/render-news.js";
    mountNews(document.getElementById("news-archive"), renderArchive, "ja");
</script>
```

`index.html`（`renderRecent`）、`cv.html`（`mountCv`）、`research.html`（`mountResearch`）も同様。

- [ ] **Step 5: テストとローカル確認**

```bash
sh tools/check.sh
```

`http://localhost:8000/` の4ページすべてを開き、記事が出ることを確認する。**`currentLang` の import を外し忘れたページは、ここで真っ白になる。**

- [ ] **Step 6: コミット**

```bash
git add js/i18n.js index.html news.html cv.html research.html tools/tests/i18n.test.mjs
git commit -m "refactor:決定言語をURLに一本化し、各ページが言語を明示する"
```

---

## Task 4: 英語ページ4枚

**Files:**
- Create: `en/index.html`、`en/news.html`、`en/research.html`、`en/cv.html`
- Modify: `index.html`、`news.html`、`cv.html`、`research.html`（ENリンクと hreflang）
- Create: `tools/tests/pages.test.mjs`

**Interfaces:**
- Consumes: `js/render-*.js`（`../js/` から）、`data/*.json`
- Produces: 8ページの相互リンク

- [ ] **Step 1: ページ間の対応を検証するテストを書く**

`tools/tests/pages.test.mjs`:

```javascript
/**
 * 8ページの対応関係を検証する。
 * 相対リンクの階層を間違えると404になるが、ブラウザで全ページを
 * 開いて確かめるのは手間がかかるので、ファイルを読んで機械的に見る。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../../", import.meta.url);
const PAGES = ["index.html", "news.html", "research.html", "cv.html"];
const SITE = "https://FSakai1997.github.io/fumiyasakai.github.io";

function read(path) {
  return readFileSync(fileURLToPath(new URL(path, ROOT)), "utf-8");
}

test("英語ページが4枚ある", () => {
  for (const page of PAGES) assert.ok(read(`en/${page}`).length > 0, `en/${page} がない`);
});

test("日本語ページは lang=ja、英語ページは lang=en", () => {
  for (const page of PAGES) {
    assert.match(read(page), /<html lang="ja">/, `${page}`);
    assert.match(read(`en/${page}`), /<html lang="en">/, `en/${page}`);
  }
});

test("日本語ページから対応する英語ページへ相対リンクがある", () => {
  for (const page of PAGES) {
    assert.ok(read(page).includes(`href="en/${page}"`), `${page} に en/${page} へのリンクがない`);
  }
});

test("英語ページから対応する日本語ページへ相対リンクがある", () => {
  for (const page of PAGES) {
    assert.ok(read(`en/${page}`).includes(`href="../${page}"`), `en/${page} に ../${page} へのリンクがない`);
  }
});

test("絶対パスのリンクを書いていない（プロジェクトページで壊れるため）", () => {
  for (const page of [...PAGES, ...PAGES.map((p) => `en/${p}`)]) {
    const links = [...read(page).matchAll(/(?:href|src)="(\/[^/][^"]*)"/g)];
    assert.deepEqual(links.map((m) => m[1]), [], `${page} に絶対パスがある`);
  }
});

test("すべてのページに hreflang の対が入っている", () => {
  for (const page of PAGES) {
    for (const file of [page, `en/${page}`]) {
      const html = read(file);
      assert.ok(html.includes(`hreflang="ja" href="${SITE}/${page}"`), `${file} の ja`);
      assert.ok(html.includes(`hreflang="en" href="${SITE}/en/${page}"`), `${file} の en`);
    }
  }
});

test("英語ページは ../js/ と ../data/ を参照する", () => {
  for (const page of PAGES) {
    const html = read(`en/${page}`);
    assert.doesNotMatch(html, /from "\.\/js\//, `en/${page} が ./js/ を参照している`);
  }
});

test("英語ページは lang として en を渡す", () => {
  for (const page of ["index.html", "news.html", "research.html", "cv.html"]) {
    assert.match(read(`en/${page}`), /,\s*"en"\s*\)/, `en/${page}`);
  }
});

test("計測タグは全ページに入っている", () => {
  for (const page of [...PAGES, ...PAGES.map((p) => `en/${p}`)]) {
    assert.ok(read(page).includes("G-HV9TNLE12M"), `${page}`);
  }
});

test("英語ページのナビは英語表記", () => {
  const html = read("en/index.html");
  for (const label of ["HOME", "NEWS", "RESEARCH", "CV"]) {
    assert.ok(html.includes(`>${label}<`), label);
  }
});
```

- [ ] **Step 2: テストを実行し、失敗することを確認する**

```bash
node --test tools/tests/pages.test.mjs
```

期待：`en/index.html がない` で失敗。

- [ ] **Step 3: 日本語4ページにENリンクと hreflang を足す**

各ページの `<head>` に：

```html
    <link rel="alternate" hreflang="ja" href="https://FSakai1997.github.io/fumiyasakai.github.io/news.html">
    <link rel="alternate" hreflang="en" href="https://FSakai1997.github.io/fumiyasakai.github.io/en/news.html">
```

（`news.html` の部分は各ページのファイル名に置き換える）

ナビの `nav-links` の末尾に：

```html
                <a href="en/news.html" class="lang-link" hreflang="en">EN</a>
```

`style.css` は変更しないため、`.lang-link` の見た目は既存の `.nav-links a` がそのまま当たる。区別が要るなら後から検討する。

- [ ] **Step 4: `en/index.html` を書く**

`index.html` を土台にし、以下を変える。

- `<html lang="en">`
- `<title>Fumiya Sakai</title>`
- `style.css` などの参照を `../style.css` に
- ナビのリンクを `index.html` → `index.html`（同階層）、言語リンクは `../index.html` で `日本語`
- 見出し・本文を英語にする：
  - `subtitle`: `Ph.D. in Earth and Planetary Science`
  - `affiliation`: `Institute of Science Tokyo / Ohta Laboratory`
  - `Profile` の氏名: `Fumiya Sakai <span class="name-en">(坂井 郁哉)</span>`
  - `profile-list`: `Department of Earth and Planetary Sciences, Institute of Science Tokyo` / `Ohta Laboratory, JSPS Postdoctoral Research Fellow (PD)` / `Research interests: high-pressure experiments, deep Earth and planetary science`
  - `View Full CV` はそのまま、リンク先は `cv.html`
  - `Recent News` の見出しはそのまま、`ニュース一覧へ →` は `All news →`
  - `Contact` の説明文: `For inquiries about my research, please contact me at the address below.`
- スクリプト：

```html
    <script type="module">
        import { mountNews, renderRecent } from "../js/render-news.js";
        mountNews(document.getElementById("recent-news"), renderRecent, "en");
    </script>
```

- [ ] **Step 5: `en/news.html` を書く**

`news.html` を土台にする。page-header は `<h1>NEWS</h1>` と `<p>Research updates and activities</p>`。

未翻訳の案内を出すため、スクリプトを次の形にする。

```html
    <script type="module">
        import { loadNews, renderArchive } from "../js/render-news.js";
        import { countUntranslated } from "../js/i18n.js";

        loadNews()
            .then((items) => {
                renderArchive(document.getElementById("news-archive"), items, "en");
                if (countUntranslated(items, "en") > 0) {
                    document.getElementById("translation-notice").hidden = false;
                }
            })
            .catch(() => {
                document.getElementById("news-archive").textContent =
                    "Could not load the news. Please reload the page.";
            });
    </script>
```

本文側：

```html
    <section class="container news-container">
        <p id="translation-notice" class="translation-notice" hidden>
            Some entries are currently available in Japanese only.
        </p>
        <div id="news-archive"></div>
    </section>
```

- [ ] **Step 6: `en/research.html` と `en/cv.html` を書く**

`en/research.html`：page-header は `<h1>RESEARCH</h1>` と `<p>Exploring the deep interiors of Earth and planets through high-pressure experiments</p>`。スクリプトは `mountResearch(document.getElementById("research-root"), "en")`。

`en/cv.html`：page-header は `<h1>Curriculum Vitae</h1>`。スクリプトは `mountCv(document.getElementById("cv-root"), "en")`。

両ページとも Contact は `en/index.html` と同じ英語文にする。

- [ ] **Step 7: 未翻訳案内のスタイルを足す**

`style.css` は変更しない制約があるため、`en/news.html` の `<head>` に最小限のスタイルを直接書く。

```html
    <style>
        .translation-notice {
            margin: 0 0 24px;
            padding: 10px 14px;
            background: #f4f8fb;
            border-left: 3px solid #cdd8e3;
            color: #667;
            font-size: 0.9rem;
        }
    </style>
```

- [ ] **Step 8: テストとローカル確認**

```bash
node --test tools/tests/pages.test.mjs
sh tools/check.sh
```

ローカルサーバーで8ページすべてを開く。

| URL | 確認内容 |
|---|---|
| `/en/index.html` | Recent News 10件が出る（本文は日本語のまま） |
| `/en/news.html` | 37件が出る。**上部に未翻訳の案内が出ている** |
| `/en/cv.html` | 12セクション。Education と Publications は**最初から英語** |
| `/en/research.html` | 2テーマ、画像が左右交互 |
| 各ページ | ナビの `日本語` / `EN` で相互に移動でき、404にならない |

**ここで `/en/` の記事が出なければ、Task 2 Step 4 のデータ参照先の修正が効いていない。**

- [ ] **Step 9: コミット**

```bash
git add en/ index.html news.html cv.html research.html tools/tests/pages.test.mjs
git commit -m "feat: add English pages under /en/"
```

---

## Task 5: 管理画面に RESEARCH タブ

**Files:**
- Create: `admin/research-form.js`
- Create: `admin/research-editor.js`
- Modify: `admin/app.js`、`admin/index.html`
- Modify: `tools/tests/editor-render.test.mjs`

**Interfaces:**
- Consumes: `admin/store.js` の `JsonStore`、`admin/preview.js` の `Preview`、`js/render-research.js` の `researchHtml`、`admin/media.js` の `pickImage`
- Produces: `renderTopicForm(container, topic, options): void`、`initResearchEditor(container, api): Promise<void>`

- [ ] **Step 1: フォームの描画テストを書く**

`tools/tests/editor-render.test.mjs` に追記する。

```javascript
const { renderTopicForm } = await import("../../admin/research-form.js");
const research = load("research.json");

test("研究テーマの編集フォームが例外なく描画できる", () => {
  for (const topic of research.topics) {
    const root = container();
    assert.doesNotThrow(
      () => renderTopicForm(root, structuredClone(topic), { lang: "ja", onChange: noop, onPickImage: noop }),
      `${topic.id} の描画で例外`,
    );
    assert.ok(root.children.length > 0);
  }
});

test("研究テーマの本文を書き換えると item に反映される", () => {
  const topic = structuredClone(research.topics[0]);
  const root = container();
  renderTopicForm(root, topic, { lang: "ja", onChange: noop, onPickImage: noop });

  const bodyArea = root.findAll("textarea").find((el) => el.value === topic.body.ja);
  assert.ok(bodyArea, "本文のテキストエリアがない");
  bodyArea.value = "<p>書き換えました</p>";
  bodyArea.fire("input");
  assert.equal(topic.body.ja, "<p>書き換えました</p>");
});

test("英語タブでは英語欄を編集し、日本語を壊さない", () => {
  const topic = structuredClone(research.topics[0]);
  const root = container();
  renderTopicForm(root, topic, { lang: "en", onChange: noop, onPickImage: noop });

  const bodyArea = root.find("textarea");
  bodyArea.value = "<p>English body.</p>";
  bodyArea.fire("input");
  assert.equal(topic.body.en, "<p>English body.</p>");
  assert.equal(topic.body.ja, research.topics[0].body.ja, "日本語が上書きされている");
});
```

- [ ] **Step 2: テストを実行し、失敗することを確認する**

```bash
node --test tools/tests/editor-render.test.mjs
```

期待：`Cannot find module '../../admin/research-form.js'`。

- [ ] **Step 3: `admin/research-form.js` を書く**

`admin/news-form.js` と同じ作りにする。項目は以下。

- 見出し（HTML可、`<br>` を使える旨を `field-hint` に書く）
- 本文（HTML、`textarea` 10行）
- 画像：`src`（`pickImage` で選べる）、`alt`、キャプション
- すべて日本語／English の切替に対応する。`alt` と `src` は言語で分けない

入力欄の生成には既存の `h` / `field` / `replace` を使う。`textInput` / `textArea` は `news-form.js` と同じものを書き写さず、この機会に **`admin/controls.js` へ切り出して両方から使う**（同じ関数が3ファイルに重複しているため）。

- [ ] **Step 4: `admin/controls.js` を作り、重複を解消する**

`textInput(value, onInput, options)` と `textArea(value, onInput, rows, placeholder)` を `admin/controls.js` に移し、`news-form.js`・`cv-form.js`・`research-form.js` から使う。挙動は変えない。

移行後に必ず実行する：

```bash
node --test "tools/tests/*.test.mjs"
```

**既存の描画テスト（37記事＋CV全セクション）が通ったままであること。** ここが通れば、切り出しで挙動が変わっていない。

- [ ] **Step 5: `admin/research-editor.js` を書く**

`admin/cv-editor.js` と同じ構成。

- `JsonStore(api, "data/research.json", (data) => data.topics.length)`
- 左：テーマ一覧。`↑` `↓` `削除`、`+ 新規`
- 中央：`renderTopicForm`
- 右：`Preview` に `researchHtml(store.data, "ja")`
- 保存：件数確認・競合検知・コミットリンクは `cv-editor.js` と同じ

新規テーマの雛形：

```javascript
{
  id: `topic-${Math.random().toString(36).slice(2, 6)}`,
  heading: { ja: "", en: "" },
  body: { ja: "<p></p>", en: "" },
  image: { src: "", alt: "", caption: { ja: "", en: "" } },
}
```

- [ ] **Step 6: タブを足す**

`admin/index.html` のタブ列に追加する（ニュースとCVの間）。

```html
            <button class="tab" role="tab" data-panel="research" aria-selected="false">研究</button>
```

```html
        <section id="panel-research" class="panel" role="tabpanel" hidden></section>
```

`admin/app.js` の `PANEL_LOADERS` に追加する。

```javascript
  research: () => import("./research-editor.js").then((m) => m.initResearchEditor),
```

- [ ] **Step 7: テストとローカル確認**

```bash
node --test "tools/tests/*.test.mjs"
sh tools/check.sh
```

`http://localhost:8000/admin/` を開き、トークンで接続する。

- 「研究」タブが開き、テーマが2件出る
- テーマを選ぶとフォームに内容が入る
- **右のプレビューが `/research.html` と同じ見た目**
- English タブに切り替えると空欄になる（未翻訳のため）
- **この時点では保存しない**

- [ ] **Step 8: コミット**

```bash
git add admin/ tools/tests/editor-render.test.mjs
git commit -m "feat: add research editor to admin"
```

---

## Task 6: 仕上げ、公開、実地確認

**Files:**
- Modify: `plan/運用手順.md`
- Modify: `robots.txt`（`/en/` は除外しない）

- [ ] **Step 1: すべての検証を走らせる**

```bash
sh tools/check.sh
```

期待：移行の検証（ニュース37件・CV11セクション・研究2テーマ）と、単体テストすべてが通る。件数が79件から増えていること。

- [ ] **Step 2: 運用手順を更新する**

`plan/運用手順.md` に節を足す。

- 英語版のURL（`/en/`）
- 翻訳の進め方：各タブの「English」に切り替えて入力する
- **着手順の推奨**：CV（31項目・985字。ここを訳すとCVページが完全な英語になる）→ RESEARCH（2テーマ・949字）→ ニュースは新しい記事から
- 未翻訳の案内は、全件訳し終われば自動的に消えること
- ページの骨組み（ナビ・見出し・Contact）を変えるときは `en/*.html` を直接編集すること

「4. CVを更新する」の後ろに「研究紹介を更新する」の節を足す。

- [ ] **Step 3: 公開する**

```bash
git add -A
git commit -m "docs: 英語版の運用手順を追加"
git push origin main
```

- [ ] **Step 4: 公開サイトで確認する**

GitHub Pages の反映を待ってから（1〜2分）、以下を確認する。

```bash
BASE="https://FSakai1997.github.io/fumiyasakai.github.io"
for p in index.html news.html research.html cv.html \
         en/index.html en/news.html en/research.html en/cv.html \
         data/research.json js/render-research.js; do
  printf "%-26s %s\n" "/$p" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$p")"
done
```

期待：すべて 200。

ブラウザで確認する項目：

| ページ | 確認内容 |
|---|---|
| `/research.html` | 改修前と同じ見た目 |
| `/en/index.html` | 英語の見出し・プロフィール |
| `/en/news.html` | 37件、未翻訳の案内が出ている |
| `/en/cv.html` | Education と Publications が英語で出ている |
| `/en/research.html` | 2テーマ、画像が左右交互 |
| 全ページ | ナビの `EN` / `日本語` で往復でき、404にならない |

- [ ] **Step 5: 翻訳の一往復を確認する**

利用者にお願いする（トークンが必要なため）。

1. 管理画面 → CVタブ → Awards → English に切り替え
2. 1項目だけ英語を入力して保存
3. 1〜2分後、`/en/cv.html` でその項目が英語になり、`/cv.html` は日本語のまま
4. `/en/cv.html` で未翻訳の案内が出る条件は NEWS ページのみなので、CVでは変化しない

---

## Self-Review

**仕様の網羅**

| 設計書の節 | 対応タスク |
|---|---|
| 3 URL構成 | Task 4 |
| 3 言語の切り替え | Task 4 Step 3〜6 |
| 3 hreflang | Task 4 Step 3〜6、テストは Step 1 |
| 4 言語の決め方 | Task 3 |
| 5 データ参照先 | Task 2 Step 4 |
| 6 研究紹介のデータ化 | Task 1、Task 2 |
| 7 RESEARCHタブ | Task 5 |
| 8 未翻訳の通知 | Task 3（数える）、Task 4 Step 5・7（出す） |
| 9 ファイル構成 | Task 1〜5 |
| 10 検証 | 各タスクのテスト、Task 6 Step 1・4 |
| 11 公開後の作業 | Task 6 Step 2 |

漏れなし。

**型の整合**

- `researchHtml(data, lang)` は Task 2 で定義、Task 5 のプレビューで利用。名前一致。
- `countUntranslated(items, lang)` は Task 3 で定義、Task 4 Step 5 で利用。引数一致。
- `renderTopicForm(container, topic, options)` は Task 5 Step 3 で定義、Step 1 のテストで利用。引数一致。
- `pick(obj, lang)` は既存。`researchHtml` が `pick(image.caption, lang)` として使う。`caption` が `{ja, en}` であることは Task 1 のスキーマと一致。
- `JsonStore(api, path, countOf)` は既存。Task 5 が `(data) => data.topics.length` を渡す。
- `textInput` / `textArea` は Task 5 Step 4 で `admin/controls.js` に集約。`news-form.js` と `cv-form.js` の呼び出しも同時に書き換える。

**プレースホルダ**

なし。
