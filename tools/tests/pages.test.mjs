/**
 * 日英8ページの対応関係を検証する。
 *
 * このサイトはプロジェクトページ形式
 * (FSakai1997.github.io/fumiyasakai.github.io/) で配信される。
 * そのため絶対パス (/news.html) は必ず壊れる。相対リンクの階層を
 * 間違えても404になるが、8ページをブラウザで開いて確かめるのは手間なので、
 * ファイルを読んで機械的に見る。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../../", import.meta.url);
const PAGES = ["index.html", "news.html", "research.html", "cv.html"];
const ALL = [...PAGES, ...PAGES.map((page) => `en/${page}`)];
const SITE = "https://FSakai1997.github.io/fumiyasakai.github.io";

function read(path) {
  return readFileSync(fileURLToPath(new URL(path, ROOT)), "utf-8");
}

test("英語ページが4枚ある", () => {
  for (const page of PAGES) assert.ok(read(`en/${page}`).length > 0, `en/${page} がない`);
});

test("日本語ページは lang=ja、英語ページは lang=en", () => {
  for (const page of PAGES) {
    assert.match(read(page), /<html lang="ja">/, page);
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
    assert.ok(
      read(`en/${page}`).includes(`href="../${page}"`),
      `en/${page} に ../${page} へのリンクがない`,
    );
  }
});

test("絶対パスのリンクを書いていない（プロジェクトページで壊れるため）", () => {
  for (const page of ALL) {
    const links = [...read(page).matchAll(/(?:href|src)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(links, [], `${page} に絶対パスがある`);
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

test("英語ページは ../js/ を参照する（同階層の js/ ではない）", () => {
  for (const page of PAGES) {
    const html = read(`en/${page}`);
    assert.doesNotMatch(html, /from "\.\/js\//, `en/${page} が ./js/ を参照している`);
    assert.match(html, /from "\.\.\/js\//, `en/${page} が ../js/ を参照していない`);
  }
});

test("英語ページはスタイルを ../style.css から読む", () => {
  for (const page of PAGES) {
    assert.ok(read(`en/${page}`).includes('href="../style.css"'), `en/${page}`);
  }
});

test("英語ページは lang として en を渡す", () => {
  for (const page of PAGES) {
    assert.match(read(`en/${page}`), /,\s*"en"\s*\)/, `en/${page}`);
  }
});

test("日本語ページは lang として ja を渡す", () => {
  for (const page of PAGES) {
    assert.match(read(page), /,\s*"ja"\s*\)/, page);
  }
});

test("計測タグは全ページに入っている", () => {
  for (const page of ALL) {
    assert.ok(read(page).includes("G-HV9TNLE12M"), page);
  }
});

test("英語ページのナビは英語表記", () => {
  const html = read("en/index.html");
  for (const label of ["HOME", "NEWS", "RESEARCH", "CV"]) {
    assert.ok(html.includes(`>${label}<`), label);
  }
});

test("英語ページに日本語の本文が残っていない（骨組み部分）", () => {
  // 記事データは日本語にフォールバックするが、ページの骨組みは英語であるべき。
  // 対象は画面に出る部分だけ。script と style の中身はコードであり、
  // コメントは日本語のままでよいので除く。言語切替リンクの「日本語」も例外。
  for (const page of PAGES) {
    const visible = read(`en/${page}`)
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>日本語</g, "><");
    const japanese = visible.match(/[぀-ヿ一-鿿]+/g) ?? [];
    assert.deepEqual(japanese, [], `en/${page} に日本語が残っている: ${japanese.slice(0, 5)}`);
  }
});

test("レンダラはデータをモジュール基準で参照する（ページ相対だと /en/ で壊れる）", () => {
  for (const file of ["js/render-news.js", "js/render-cv.js", "js/render-research.js"]) {
    const source = read(file);
    assert.match(source, /new URL\("\.\.\/data\//, `${file} がモジュール基準になっていない`);
    assert.doesNotMatch(source, /fetch\("data\//, `${file} がページ相対で参照している`);
  }
});
