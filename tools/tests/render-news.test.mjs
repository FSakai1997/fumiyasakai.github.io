/**
 * 実データ (data/news.json) を使ってニュースの描画結果を検証する。
 *
 * ブラウザは使わず、コンテナを最小限に模して innerHTML を取り出す。
 * 生成されるHTMLのクラス構成・件数・開閉状態・日付表記を固定する。
 * style.css は既存のクラス名に依存しているため、クラス名が変われば
 * 見た目が壊れる。ここで固定しておけば、その退行を検知できる。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { newsCardHtml, renderArchive, renderRecent, RECENT_NEWS_LIMIT } from "../../js/render-news.js";

const dataUrl = new URL("../../data/news.json", import.meta.url);
const news = JSON.parse(readFileSync(fileURLToPath(dataUrl), "utf-8"));
const items = news.items.filter((item) => !item.draft);

/** container.innerHTML の代役。attachToggles は空配列を受け取って何もしない。 */
function fakeContainer() {
  return { innerHTML: "", querySelectorAll: () => [] };
}

function renderedArchive() {
  const container = fakeContainer();
  renderArchive(container, items, "ja");
  return container.innerHTML;
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test("移行した記事は37件ある", () => {
  assert.equal(items.length, 37);
});

test("一覧は37件すべてを news-card として描画する", () => {
  assert.equal(countOccurrences(renderedArchive(), '<article class="news-card">'), 37);
});

test("年グループは5つで、ラベルが移行前と一致する", () => {
  const html = renderedArchive();
  const labels = [...html.matchAll(/class="year-toggle[^"]*"[^>]*>([^<]*)</g)].map((m) =>
    m[1].trim(),
  );
  assert.deepEqual(labels, ["2026年", "2025年", "2024年", "2023年", "2022年以前"]);
});

test("先頭2グループが開き、残りは閉じている（移行前と同じ状態）", () => {
  const html = renderedArchive();
  const displays = [...html.matchAll(/class="year-archive" style="display: (\w+);"/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(displays, ["block", "block", "none", "none", "none"]);
  assert.equal(countOccurrences(html, "year-toggle active"), 2);
});

test("期間表記の日付は原文のまま表示される", () => {
  const html = renderedArchive();
  for (const label of ["2024.09-12", "2023.12.11-15", "2023.10.18-20", "2023.03.12-14", "2022.08.22-26"]) {
    assert.ok(html.includes(`<span class="news-date">${label}</span>`), `${label} が見つからない`);
  }
});

test("画像3件が正しいレイアウトで描画される", () => {
  const html = renderedArchive();
  // 横並び: news-body に has-image が付く
  assert.ok(html.includes('<div class="news-body has-image">'));
  assert.equal(countOccurrences(html, "news-body has-image"), 2);
  // 中央寄せ: div に text-align、img に width
  // src はページの階層に依存しない絶対URLになる（assetUrl 経由）。
  assert.match(
    html,
    /<div class="news-image" style="text-align:center;"><img src="[^"]*\/image\/SP_award_cut\.JPG" alt="SP8Award" style="width:75%">/,
  );
  assert.equal(countOccurrences(html, "<img src="), 3);
});

test("引用ボックスのリンクは新しいタブで開く", () => {
  const html = renderedArchive();
  const links = [...html.matchAll(/<a href="([^"]+)" target="_blank" class="btn-sm">/g)];
  assert.ok(links.length >= 24, `引用リンクが少なすぎる: ${links.length}`);
  assert.ok(links.every((m) => m[1].startsWith("http")));
});

test("引用が2件ある記事は、両方の引用を1つのボックスに出す", () => {
  const award = items.find((i) => i.date === "2026-06-17");
  const html = newsCardHtml(award, "ja");
  assert.equal(countOccurrences(html, '<div class="citation-box">'), 1);
  assert.equal(countOccurrences(html, "論文を見る"), 2);
  assert.ok(html.includes("2025JE009596"));
  assert.ok(html.includes("j.epsl.2025.119785"));
});

test("トップページは最新10件を和式の日付で出す", () => {
  const container = fakeContainer();
  renderRecent(container, items, "ja");
  const rows = container.innerHTML.split("\n").filter((r) => r.startsWith("<li>"));
  assert.equal(rows.length, RECENT_NEWS_LIMIT);
  assert.equal(rows[0], "<li>2026年9月16日 - 共著論文がGPLで出版されました</li>");
});

test("英語指定でも、未翻訳の記事は日本語で表示される", () => {
  // 実データの翻訳が進むとこの性質は観測できなくなるので、
  // 英語を空にした記事を作って確かめる。
  const untranslated = items.slice(0, 3).map((item) => ({
    ...structuredClone(item),
    en: { title: "", body: "" },
  }));
  const container = fakeContainer();
  renderRecent(container, untranslated, "en");
  assert.ok(container.innerHTML.includes(untranslated[0].ja.title));
});

test("英訳済みの記事は英語で表示される", () => {
  const translated = items.filter((item) => item.en?.title);
  assert.ok(translated.length > 0, "英訳済みの記事が1件もない");
  const container = fakeContainer();
  renderRecent(container, translated, "en");
  assert.ok(container.innerHTML.includes(translated[0].en.title));
  assert.ok(!container.innerHTML.includes(translated[0].ja.title));
});

test("タイトルに含まれる < > & はエスケープされる", () => {
  const html = newsCardHtml(
    { date: "2026-01-01", tag: "News", ja: { title: "a<b>&c", body: "" }, en: {} },
    "ja",
  );
  assert.ok(html.includes("a&lt;b&gt;&amp;c"));
});

/**
 * 引用ボックスの言語対応。
 *
 * 引用の本文とリンクのラベルは、当初ひとつの文字列として持っていた。
 * そのため英語ページでも「論文を見る →」のような日本語のボタンが出ていた。
 * 画像の代替テキストと同じ種類の見落とし。
 */

test("引用のリンクラベルは言語別に持つ", () => {
  const item = items.find((i) => (i.citations ?? []).length > 0);
  const link = item.citations[0].links[0];
  assert.equal(typeof link.label, "object", "ラベルが文字列のままになっている");
  assert.ok("ja" in link.label && "en" in link.label);
});

test("引用の本文は言語別に持つ", () => {
  const item = items.find((i) => (i.citations ?? []).length > 0);
  assert.equal(typeof item.citations[0].text, "object", "引用本文が文字列のままになっている");
});

test("英訳済みの記事は、引用ボックスにも日本語が残らない", () => {
  // 未訳の記事の引用は日本語のままでよい。英訳を入れた記事だけを対象にする。
  // 翻訳が進むほど検査対象が増え、翻訳の途中でも落ちない。
  const translated = items.filter((item) => item.en?.title && (item.citations ?? []).length > 0);
  assert.ok(translated.length > 0, "引用を持つ英訳済みの記事が1件もない");

  for (const item of translated) {
    const boxes =
      newsCardHtml(item, "en").match(/<div class="citation-box">[\s\S]*?<\/div>/g) ?? [];
    const japanese = boxes.join("").match(/[\u3040-\u30ff\u4e00-\u9fff]+/g) ?? [];
    assert.deepEqual(
      japanese,
      [],
      `${item.date} の英語引用に日本語が残っている: ${japanese.slice(0, 5)}`,
    );
  }
});

test("リンクのラベルは全記事で英訳済み（英語ページにボタンの日本語を残さない）", () => {
  const missing = [];
  for (const item of items) {
    for (const citation of item.citations ?? []) {
      for (const link of citation.links ?? []) {
        if (!link.label?.en?.trim()) missing.push(`${item.date}: ${link.label?.ja}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("日本語ページの引用ボックスは日本語のまま", () => {
  const html = items.map((item) => newsCardHtml(item, "ja")).join("\n");
  assert.ok(html.includes("論文を見る"), "日本語のラベルが失われている");
});
