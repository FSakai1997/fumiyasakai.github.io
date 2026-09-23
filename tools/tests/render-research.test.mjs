/**
 * 実データ (data/research.json) を使って研究紹介の描画を検証する。
 *
 * style.css は .research-topic / .research-topic.reverse を使って
 * 画像を左右交互に出す。クラス名が変われば見た目が壊れるので固定する。
 */
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

test("テーマの間にだけ区切り線が入る", () => {
  assert.equal(count(html, '<hr class="research-divider">'), 1);
  assert.ok(!html.trimEnd().endsWith('<hr class="research-divider">'), "末尾に区切り線が残っている");
});

test("見出しの <br> は保たれる", () => {
  assert.ok(html.includes("<br>"), "見出しの改行が失われている");
});

test("画像とキャプションが描画される", () => {
  assert.ok(html.includes('src="image/Earth.jpg"'));
  assert.ok(html.includes('<div class="img-caption">高圧実験による地球深部物質の探査</div>'));
  assert.equal(count(html, "<img "), 2);
});

test("画像が読めないときに崩れないよう onerror を残す", () => {
  assert.equal(count(html, "this.style.display='none'"), 2);
});

test("開きタグと閉じタグの数が合う", () => {
  assert.equal(count(html, "<div "), count(html, "</div>"));
  assert.equal(count(html, "<section "), count(html, "</section>"));
});

test("英語が未入力なら日本語を表示する", () => {
  // 実データの翻訳が進むとこの性質は観測できなくなるので、
  // 英語を空にしたデータを作って確かめる。
  const untranslated = structuredClone(data);
  for (const topic of untranslated.topics) {
    topic.heading.en = "";
    topic.body.en = "";
    if (topic.image) topic.image.caption.en = "";
  }

  const englishHtml = researchHtml(untranslated, "en");
  assert.ok(englishHtml.includes("地球コアの組成決定"));
  assert.ok(englishHtml.includes("高圧実験による地球深部物質の探査"));
});

test("実データは英訳済みで、英語ページに日本語が出ない", () => {
  const englishHtml = researchHtml(data, "en");
  assert.ok(englishHtml.includes("Determining the Composition"));
  const japanese = englishHtml.match(/[぀-ヿ一-鿿]+/g) ?? [];
  assert.deepEqual(japanese, [], `英語ページに日本語が残っている: ${japanese.slice(0, 3)}`);
});

test("英語が入っていれば英語を表示する", () => {
  const translated = structuredClone(data);
  translated.topics[0].heading.en = "Composition of the Earth core";
  translated.topics[0].body.en = "<p>English body.</p>";
  translated.topics[0].image.caption.en = "High-pressure experiments";

  const englishHtml = researchHtml(translated, "en");
  assert.ok(englishHtml.includes("Composition of the Earth core"));
  assert.ok(englishHtml.includes("English body."));
  assert.ok(englishHtml.includes("High-pressure experiments"));
  assert.ok(!englishHtml.includes("地球コアの組成決定"), "日本語の見出しが残っている");
});

test("画像のないテーマでも描画できる", () => {
  const noImage = { schemaVersion: 1, topics: [{ id: "x", heading: { ja: "見出し" }, body: { ja: "<p>本文</p>" }, image: null }] };
  const out = researchHtml(noImage, "ja");
  assert.ok(out.includes("見出し"));
  assert.equal(count(out, "<img "), 0);
});

test("テーマが0件でも落ちない", () => {
  assert.equal(researchHtml({ schemaVersion: 1, topics: [] }, "ja"), "");
});

test("代替テキストも言語に応じて切り替わる", () => {
  // alt は読み上げソフトが読む文なので、ページの言語に合わせる必要がある。
  const japanese = researchHtml(data, "ja");
  const english = researchHtml(data, "en");
  assert.ok(japanese.includes('alt="地球内部構造とDAC実験のイメージ"'));
  assert.ok(english.includes("alt=\"Illustration of the Earth"));
  assert.ok(!english.includes('alt="地球内部構造'), "英語ページに日本語の alt が残っている");
});
