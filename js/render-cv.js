/**
 * data/cv.json からCVを描画する。
 *
 * 生成するHTMLは、移行前の cv.html と同じクラス構成を保つ。
 * style.css を変更せずに見た目を維持するため。
 *
 * セクションは2種類だけ:
 *   dated    … 日付と内容の2列 (Education, Awards, Lectures など)
 *   numbered … 連番リスト (Publications, Presentations など)
 */

import { pick } from "./i18n.js";

// ページからの相対パスにすると /en/ 配下から呼んだときに壊れる。
// このモジュールは常に /js/ にあるので、モジュール自身の位置を基準に解決する。
const DATA_URL = new URL("../data/cv.json", import.meta.url);

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function profileHtml(profile, lang) {
  const name = pick({ ja: profile?.ja?.name, en: profile?.en?.name }, lang);
  const jaLines = profile?.ja?.lines ?? [];
  const enLines = profile?.en?.lines ?? [];
  // 行の配列は、英語が1行も入っていなければ日本語へ落とす。
  const lines = enLines.length > 0 && lang === "en" ? enLines : jaLines;
  return [
    '<section class="cv-section">',
    '    <h2 class="cv-heading">Profile</h2>',
    `    <p><strong>${escapeText(name)}</strong></p>`,
    '    <ul class="cv-profile-list">',
    ...lines.map((line) => `        <li>${line}</li>`),
    "    </ul>",
    "</section>",
  ].join("\n");
}

function datedSectionHtml(section, lang) {
  const rows = section.entries.flatMap((entry) => [
    `        <div class="cv-date">${escapeText(entry.date ?? "")}</div>`,
    `        <div class="cv-content">${pick(entry, lang)}</div>`,
  ]);
  return [
    '<section class="cv-section">',
    `    <h2 class="cv-heading">${escapeText(section.heading)}</h2>`,
    '    <div class="cv-grid">',
    ...rows,
    "    </div>",
    "</section>",
  ].join("\n");
}

function numberedSectionHtml(section, lang) {
  const listClass = section.listClass || "publication-list";
  return [
    '<section class="cv-section">',
    `    <h2 class="cv-heading">${escapeText(section.heading)}</h2>`,
    `    <ol class="${listClass}" reversed>`,
    ...section.entries.map((entry) => `        <li>${pick(entry, lang)}</li>`),
    "    </ol>",
    "</section>",
  ].join("\n");
}

/** CV全体のHTMLを組み立てる。管理画面のプレビューもこの関数を使う。 */
export function cvHtml(data, lang) {
  const sections = (data.sections ?? []).map((section) =>
    section.type === "numbered"
      ? numberedSectionHtml(section, lang)
      : datedSectionHtml(section, lang),
  );
  return [profileHtml(data.profile, lang), ...sections].join("\n\n");
}

/** data/cv.json を読む。 */
export async function loadCv() {
  const response = await fetch(DATA_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`cv.json の取得に失敗しました (${response.status})`);
  return response.json();
}

/** CVページに描画する。 */
export function renderCv(container, data, lang) {
  if (!container) return;
  container.innerHTML = cvHtml(data, lang);
}

/** ページ読み込み時の定型処理。失敗しても空白のページを見せない。 */
export async function mountCv(container, lang) {
  try {
    renderCv(container, await loadCv(), lang);
  } catch (error) {
    console.error(error);
    container.innerHTML =
      '<p class="load-error">CVを読み込めませんでした。時間をおいて再読み込みしてください。</p>';
  }
}
