import { test } from "node:test";
import assert from "node:assert/strict";
import { pick, pickTitle, countUntranslated } from "../../js/i18n.js";

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
  assert.equal(pick(undefined, "en"), "");
});

test("pickTitle は記事の言語別タイトルを取り出す", () => {
  const item = {
    ja: { title: "共著論文が出版されました", body: "<p>本文</p>" },
    en: { title: "A co-authored paper", body: "" },
  };
  assert.equal(pickTitle(item, "en"), "A co-authored paper");
  assert.equal(pickTitle(item, "ja"), "共著論文が出版されました");
});

test("pickTitle は英語タイトルが未入力なら日本語を返す", () => {
  const item = {
    ja: { title: "共著論文が出版されました", body: "<p>本文</p>" },
    en: { title: "", body: "" },
  };
  assert.equal(pickTitle(item, "en"), "共著論文が出版されました");
});

test("countUntranslated は英語が空の項目を数える", () => {
  const items = [
    { ja: { title: "あ", body: "<p>い</p>" }, en: { title: "A", body: "<p>B</p>" } },
    { ja: { title: "う", body: "<p>え</p>" }, en: { title: "", body: "" } },
    { ja: { title: "お", body: "<p>か</p>" }, en: { title: "C", body: "" } },
  ];
  assert.equal(countUntranslated(items, "en"), 2);
});

test("countUntranslated は空白だけの英語も未翻訳とみなす", () => {
  const items = [{ ja: { title: "あ", body: "<p>い</p>" }, en: { title: "  ", body: "  " } }];
  assert.equal(countUntranslated(items, "en"), 1);
});

test("countUntranslated は日本語表示では常に0を返す", () => {
  const items = [{ ja: { title: "あ", body: "" }, en: { title: "", body: "" } }];
  assert.equal(countUntranslated(items, "ja"), 0);
});

test("countUntranslated は空配列で0を返す", () => {
  assert.equal(countUntranslated([], "en"), 0);
});

test("countUntranslated はすべて翻訳済みなら0を返す（案内が自動的に消える）", () => {
  const items = [{ ja: { title: "あ", body: "<p>い</p>" }, en: { title: "A", body: "<p>B</p>" } }];
  assert.equal(countUntranslated(items, "en"), 0);
});

test("currentLang は削除されている", async () => {
  const module = await import("../../js/i18n.js");
  assert.equal(
    module.currentLang,
    undefined,
    "言語はURLで決まるため、この関数を残すと決め方が二重になる",
  );
});
