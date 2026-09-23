/**
 * GitHub Contents API ラッパのうち、ブラウザに依存しない部分を検証する。
 *
 * base64 変換は日本語を扱うため、素の btoa() が使えない。
 * ここを間違えると保存した記事が文字化けする（しかも保存は成功して見える）ので、
 * 往復が壊れていないことを機械的に固定しておく。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { encodeBase64, decodeBase64, ConflictError } from "../../admin/github-api.js";

test("日本語を含む文字列が base64 を往復しても壊れない", () => {
  const text = "共著論文が<i>Geochemical Perspectives Letters</i>にて出版されました。";
  assert.equal(decodeBase64(encodeBase64(text)), text);
});

test("記事データ相当のJSONが往復する", () => {
  const data = {
    items: [
      {
        ja: { title: "火星コアの構造解明", body: "<p>高温高圧下その場X線回折測定により…</p>" },
        citations: [{ text: "坂井 郁哉, 2026.", links: [{ label: "論文を見る &rarr;", url: "https://doi.org/10" }] }],
      },
    ],
  };
  const json = JSON.stringify(data, null, 2);
  assert.deepEqual(JSON.parse(decodeBase64(encodeBase64(json))), data);
});

test("全角空白・絵文字・特殊記号も保たれる", () => {
  const text = "(参考)　日本地球惑星科学連合 ｜ Fe₁₂S₇ ｜ 約17 wt% ｜ →";
  assert.equal(decodeBase64(encodeBase64(text)), text);
});

test("空文字列を扱える", () => {
  assert.equal(decodeBase64(encodeBase64("")), "");
});

test("GitHubが返す改行入りの base64 を読める", () => {
  // Contents API のレスポンスは 60文字ごとに改行が入る。
  const text = "これは十分に長い日本語の本文です。".repeat(20);
  const wrapped = encodeBase64(text).replace(/(.{60})/g, "$1\n");
  assert.equal(decodeBase64(wrapped), text);
});

test("ConflictError は上書きせず中止したことを伝える", () => {
  const error = new ConflictError("data/news.json");
  assert.equal(error.name, "ConflictError");
  assert.equal(error.path, "data/news.json");
  assert.match(error.message, /上書きを避けるため/);
});
