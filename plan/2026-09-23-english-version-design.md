# 設計書：英語版ページ

作成日：2026-09-23
前提：`plan/2026-09-23-online-editing-design.md` の実装が完了していること

---

## 1. 目的

HOME / NEWS / RESEARCH / CV の英語版を用意し、海外の研究者に渡せる固定URLを持つ。

翻訳は利用者が管理画面から少しずつ進める。**未翻訳の項目は日本語で表示される**ため、完成を待たずに公開できる。

### 決定事項（確認済み）

| 論点 | 決定 |
|---|---|
| 翻訳の担当 | 利用者が管理画面から順次入力する。下訳は作らない |
| URLの形 | `/en/` 配下の別ページ |
| research.html | データ化し、管理画面から翻訳できるようにする |
| ナビのENボタン | 最初から出す |

### 今回やらないこと

- 英語本文の下訳作成（利用者が書く）
- `notes/` 配下の英語化（独立した資料のため）
- 言語の自動判定（ブラウザの言語設定による転送）。意図しない転送は混乱を招くため、切替は利用者の明示的な操作に限る

---

## 2. 翻訳が必要な分量（実測）

| 対象 | 日本語の分量 | 公開初日の状態 |
|---|---|---|
| ナビ・見出し・連絡先 | 148字 | **英語**（英語ページに直接書く） |
| CV: Education / Publications / 国際学会発表 25件 | 0字 | **英語**（もともと英語） |
| CV: Awards / 国内発表 / Outreach など 31項目 | 985字 | 日本語 |
| RESEARCH: 研究テーマ2件 | 949字 | 日本語 |
| NEWS: 37記事（タイトル＋本文） | 7,765字 | 日本語 |
| **合計** | **約9,850字** | |

**CVページは公開初日からほぼ英語として成立する。** 翻訳の主な対象はニュースと研究紹介。

---

## 3. URL構成

```
/index.html          /en/index.html
/news.html           /en/news.html
/research.html       /en/research.html
/cv.html             /en/cv.html
/admin/              （管理画面。日本語UIのまま。言語切替は不要）
```

記事データ（`data/*.json`）は**日英で共用**する。英語ページは同じデータを `lang="en"` で描画し、英語が空の項目は日本語を表示する。

### 言語の切り替え

各ページのナビに、対応するページへの静的リンクを置く。JavaScriptは使わない。

- `/news.html` の `EN` → `en/news.html`
- `/en/news.html` の `日本語` → `../news.html`

相対リンクにする。このサイトはプロジェクトページ形式（`FSakai1997.github.io/fumiyasakai.github.io/`）で配信されるため、絶対パス（`/news.html`）は壊れる。

### 検索エンジン向けの対応

各ページに、対になるページを示す `hreflang` を入れる。

```html
<link rel="alternate" hreflang="ja" href="https://FSakai1997.github.io/fumiyasakai.github.io/news.html">
<link rel="alternate" hreflang="en" href="https://FSakai1997.github.io/fumiyasakai.github.io/en/news.html">
```

英語ページは `<html lang="en">` とする。

---

## 4. 言語の決め方を単純にする

現在の `js/i18n.js` には `currentLang()` があり、`?lang=en` とブラウザの保存領域から言語を決めている。**この仕組みは削除する。**

理由：言語はURLで決まるようになるため、2つの決め方が併存すると、`/en/` のページを `?lang=ja` で開いたときにどちらが勝つのかが曖昧になる。各ページが自分の言語を定数として渡す方が、読んで分かる。

```html
<!-- /news.html -->
<script type="module">
    import { mountNews, renderArchive } from "./js/render-news.js";
    mountNews(document.getElementById("news-archive"), renderArchive, "ja");
</script>

<!-- /en/news.html -->
<script type="module">
    import { mountNews, renderArchive } from "../js/render-news.js";
    mountNews(document.getElementById("news-archive"), renderArchive, "en");
</script>
```

`pick()` / `pickTitle()` / `pickBody()` のフォールバックはそのまま残す。

---

## 5. データの参照先を、ページの位置に依存させない

現在 `js/render-news.js` は `fetch("data/news.json")` としている。これは**ページからの相対パス**なので、`/en/news.html` から呼ぶと `/en/data/news.json` を探して404になる。

モジュール自身の位置を基準に解決する形へ変える。

```javascript
const DATA_URL = new URL("../data/news.json", import.meta.url);
```

`js/render-news.js` は常に `/js/` にあるので、`../data/` は必ず `/data/` を指す。呼び出し元がどの階層にあっても正しく解決される。`render-cv.js` と新設の `render-research.js` も同じ形にする。

---

## 6. 研究紹介のデータ化

### 現状

`research.html` に研究テーマが2件、直書きされている。各テーマは「見出し」「本文（段落複数）」「画像」「画像キャプション」でできている。

### `data/research.json`

```json
{
  "schemaVersion": 1,
  "topics": [
    {
      "id": "earth-core",
      "heading": { "ja": "地球コアの組成決定：<br>軽元素の分配挙動の解明", "en": "" },
      "body": { "ja": "<p>近年、はやぶさ2をはじめとした…</p>", "en": "" },
      "image": {
        "src": "image/Earth.jpg",
        "alt": "地球内部構造とDAC実験のイメージ",
        "caption": { "ja": "高圧実験による地球深部物質の探査", "en": "" }
      }
    }
  ]
}
```

見出しに `<br>` が入るため、`heading` はHTML文字列として持つ。

### 描画

`js/render-research.js` が `research-topic` / `research-text` / `research-image` / `img-caption` / `research-divider` を、現在と同じクラス構成で組み立てる。テーマの間には区切り線を入れる。

### ページ見出しなどの固定文言

ナビ、`<h1>RESEARCH</h1>`、その下の副題、Contact、フッタは**各HTMLファイルに直接書く**。データ化しない。

理由：これらはページの骨組みであって記事ではない。日英で別ファイルになるため、それぞれの言語で書けば二重管理にならない。変更頻度も低い（所属が変わるときなど）。

---

## 7. 管理画面に RESEARCH タブを追加する

ニュース・CVと同じ構成にする。

- 左：研究テーマの一覧（2件）
- 中央：見出し・本文・画像・キャプションの編集。日本語／English タブ
- 右：ライブプレビュー（`js/render-research.js` を共用）

テーマの追加・削除・並べ替えもできるようにする。研究テーマは今後増える可能性が高く、CVのセクションとは事情が違うため。

保存処理は `JsonStore` をそのまま使う（sha の受け渡し、競合検知、件数確認、未保存警告がすべて効く）。

---

## 8. 未翻訳であることを伝える

英語ページで日本語にフォールバックした項目がある場合、ページ上部に1行だけ出す。

> Some entries are currently available in Japanese only.

`js/i18n.js` に `countUntranslated(items, lang)` を置き、ページ側が0件かどうかで表示を決める。**翻訳が終われば自動的に消える。**

理由：英語ページに日本語が混ざっていること自体は避けられないが、「壊れている」のか「まだ訳していない」のかは、訪問者に分かる方がよい。

---

## 9. ファイル構成

```
en/                      ← 新規
  index.html
  news.html
  research.html
  cv.html
data/
  research.json          ← 新規
js/
  render-research.js     ← 新規
  render-news.js         ← 変更（データ参照先、未翻訳の数え方）
  render-cv.js           ← 変更（データ参照先）
  i18n.js                ← 変更（currentLang 削除、countUntranslated 追加）
admin/
  research-editor.js     ← 新規
  research-form.js       ← 新規
  app.js                 ← 変更（RESEARCHタブ追加）
  index.html             ← 変更（RESEARCHタブ追加）
index.html               ← 変更（ENリンク、hreflang、lang明示）
news.html                ← 同上
research.html            ← 同上＋データ化
cv.html                  ← 同上
tools/
  migrate_research.py    ← 新規
  fixtures/research.original.html.txt  ← 新規
  verify_migration.py    ← 変更（research の検証を追加）
  tests/                 ← 追加
```

---

## 10. 検証

| 対象 | 方法 | 合格条件 |
|---|---|---|
| research の移行 | 移行前HTMLとの本文テキスト・リンク・画像の機械比較 | 完全一致 |
| データ参照先 | `/en/` からの読み込みをローカルサーバーで確認 | 8ページすべてで記事が出る |
| ページの対応関係 | 8ページのHTMLを走査 | 日英が正しく相互リンクし、`hreflang` と `lang` が対になっている |
| 英語フォールバック | 描画テスト | 英語が空の項目に日本語が出る |
| 未翻訳の通知 | 描画テスト | 未翻訳が1件でもあれば出る／0件なら出ない |
| RESEARCH編集フォーム | 疑似DOMでの描画テスト | 例外なく描画し、入力が反映される |
| 既存の検証 | `sh tools/check.sh` | 79件すべて通過したまま |

---

## 11. 公開後に利用者が行うこと

1. 管理画面の各タブで「English」に切り替え、翻訳を入力する
2. CVは31項目・約985字。ここから始めると効果が大きい（CVページが完全な英語になる）
3. 次に RESEARCH（949字、2テーマ）
4. ニュースは新しい記事から順に。古い記事は日本語のままでも支障が小さい

---

## 12. 未決事項

なし。実装計画の作成に進める状態。
