/**
 * 実データ (data/cv.json) を使ってCVの描画結果を検証する。
 *
 * 特に Lectures セクションは、移行前の cv.html で <div class="cv-grid"> が
 * 閉じられておらず構造が壊れていた。データ化で解消したことをここで固定する。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { cvHtml } from "../../js/render-cv.js";

const dataUrl = new URL("../../data/cv.json", import.meta.url);
const cv = JSON.parse(readFileSync(fileURLToPath(dataUrl), "utf-8"));
const html = cvHtml(cv, "ja");

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test("Profile を含めて12セクションを描画する", () => {
  assert.equal(countOccurrences(html, '<section class="cv-section">'), 12);
});

test("見出しの順序が移行前と一致する", () => {
  const headings = [...html.matchAll(/<h2 class="cv-heading">(.*?)<\/h2>/g)].map((m) => m[1]);
  assert.deepEqual(headings, [
    "Profile",
    "Education",
    "Grants &amp; Scholarships",
    "Awards",
    "Publications",
    "Proceedings / unreviewed paper",
    "International Conference Presentations (1st Author)",
    "Domestic Conference Presentations (1st Author)",
    "Conference Presentations (co-author)",
    "Lectures",
    "Outreach Activities",
    "Others",
  ]);
});

test("開いた div が残らない（移行前の Lectures の不具合が解消している）", () => {
  assert.equal(countOccurrences(html, "<div "), countOccurrences(html, "</div>"));
  assert.equal(countOccurrences(html, "<section "), countOccurrences(html, "</section>"));
  assert.equal(countOccurrences(html, "<ol "), countOccurrences(html, "</ol>"));
});

test("Lectures は3件で、YouTubeリンクを保持している", () => {
  const lectures = cv.sections.find((s) => s.heading === "Lectures");
  assert.equal(lectures.entries.length, 3);
  assert.equal(lectures.type, "dated");
  assert.ok(lectures.entries[1].ja.includes("youtube.com"));
});

test("Publications は8件の連番リストとして出る", () => {
  const publications = cv.sections.find((s) => s.heading === "Publications");
  assert.equal(publications.entries.length, 8);
  assert.ok(html.includes('<ol class="publication-list" reversed>'));
});

test("発表リストは presentation-list クラスを使う", () => {
  assert.ok(html.includes('<ol class="presentation-list" reversed>'));
});

test("日付つきセクションは cv-date と cv-content を対で出す", () => {
  assert.equal(countOccurrences(html, '<div class="cv-date">'), countOccurrences(html, '<div class="cv-content">'));
});

test("エントリの総数は69件", () => {
  const total = cv.sections.reduce((sum, s) => sum + s.entries.length, 0);
  assert.equal(total, 69);
});

test("英語指定でも、未翻訳の項目は日本語で表示される", () => {
  // 実データの翻訳が進むとこの性質は観測できなくなるので、
  // 英語を空にしたデータを作って確かめる。
  const untranslated = structuredClone(cv);
  untranslated.profile.en = { name: "", lines: [] };
  for (const section of untranslated.sections) {
    for (const entry of section.entries) entry.en = "";
  }

  const englishHtml = cvHtml(untranslated, "en");
  assert.ok(englishHtml.includes("東京科学大学理学院 地球惑星科学系"));
  assert.ok(englishHtml.includes("Geochemical Perspectives Letters"));
});

test("英語が入っていれば英語を表示する", () => {
  const englishHtml = cvHtml(cv, "en");
  assert.ok(englishHtml.includes("Institute of Science Tokyo"));
  assert.ok(!englishHtml.includes("東京科学大学理学院"), "日本語のプロフィールが残っている");
});
