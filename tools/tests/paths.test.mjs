/**
 * 画像などの参照先が、ページの階層に依存しないことを検証する。
 *
 * 実際に起きた不具合:
 *   レンダラが src="image/Earth.jpg" というページ相対のパスを出していた。
 *   /research.html からは正しく解決されるが、/en/research.html からは
 *   /en/image/Earth.jpg を探して404になる。さらに onerror で画像を
 *   隠していたため、壊れたアイコンすら出ず静かに消えていた。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { assetUrl } from "../../js/paths.js";
import { researchHtml } from "../../js/render-research.js";
import { newsCardHtml } from "../../js/render-news.js";

function load(name) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../../data/${name}`, import.meta.url)), "utf-8"));
}

const research = load("research.json");
const news = load("news.json");

/**
 * ページからの相対パスを拾う。
 *
 * スキーム付き（https:, file: など）とルート相対（/ 始まり）は、
 * ページの階層に影響されないので対象外。Node では import.meta.url が
 * file:// になるため、http だけを見るのでは足りない。
 */
function pageRelativeSources(html) {
  return [...html.matchAll(/src="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((src) => !/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith("/"));
}

test("assetUrl はサイト内のパスを絶対URLに直す", () => {
  const url = assetUrl("image/Earth.jpg");
  assert.ok(url.endsWith("/image/Earth.jpg"), url);
  assert.doesNotMatch(url, /\/en\/image\//, "ページの階層が混ざっている");
});

test("assetUrl は外部URLをそのまま返す", () => {
  assert.equal(assetUrl("https://example.com/a.png"), "https://example.com/a.png");
  assert.equal(assetUrl("//example.com/a.png"), "//example.com/a.png");
  assert.equal(assetUrl("data:image/png;base64,AAA"), "data:image/png;base64,AAA");
});

test("assetUrl は空を空のまま返す", () => {
  assert.equal(assetUrl(""), "");
  assert.equal(assetUrl(null), "");
  assert.equal(assetUrl(undefined), "");
});

test("研究紹介の画像はページ相対にならない", () => {
  for (const lang of ["ja", "en"]) {
    const relative = pageRelativeSources(researchHtml(research, lang));
    assert.deepEqual(relative, [], `${lang}: ページ相対の src が残っている`);
  }
});

test("ニュースの画像はページ相対にならない", () => {
  const items = news.items.filter((item) => !item.draft);
  for (const lang of ["ja", "en"]) {
    const html = items.map((item) => newsCardHtml(item, lang)).join("\n");
    const relative = pageRelativeSources(html);
    assert.deepEqual(relative, [], `${lang}: ページ相対の src が残っている`);
  }
});

test("画像の src は /image/ を指す", () => {
  const html = researchHtml(research, "en");
  const sources = [...html.matchAll(/src="([^"]*)"/g)].map((m) => m[1]);
  assert.equal(sources.length, 2);
  for (const src of sources) {
    assert.match(src, /\/image\/[^/]+$/, src);
    assert.doesNotMatch(src, /\/en\//, `英語ページの階層が混ざっている: ${src}`);
  }
});
