import { test } from "node:test";
import assert from "node:assert/strict";
import { pick, pickTitle } from "../../js/i18n.js";

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
