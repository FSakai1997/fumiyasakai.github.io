/**
 * data/research.json から研究紹介を描画する。
 *
 * 生成するHTMLは、移行前の research.html と同じクラス構成を保つ。
 * style.css を変更せずに見た目を維持するため。
 *
 * researchHtml は管理画面のライブプレビューからも呼ばれる。
 * プレビューと本番が食い違わないよう、描画コードはここ1箇所に置く。
 */

import { pick } from "./i18n.js";
import { assetUrl } from "./paths.js";

// ページからの相対パスにすると /en/ 配下から呼んだときに壊れる。
// このモジュールは常に /js/ にあるので、モジュール自身の位置を基準に解決する。
const DATA_URL = new URL("../data/research.json", import.meta.url);

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function imageHtml(image, lang) {
  if (!image || !image.src) return "";
  const caption = pick(image.caption, lang);
  return [
    '    <div class="research-image">',
    `        <img src="${escapeAttribute(assetUrl(image.src))}" alt="${escapeAttribute(pick(image.alt, lang))}" onerror="this.style.display='none'">`,
    caption ? `        <div class="img-caption">${escapeText(caption)}</div>` : "",
    "    </div>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * テーマ1件分のHTML。
 * 偶数番目（0始まりで奇数）には reverse を付け、画像を反対側に出す。
 * 交互の配置をデータではなく順序から決めることで、テーマを増やしても揃う。
 */
function topicHtml(topic, index, lang) {
  const sectionClass = index % 2 === 1 ? "research-topic reverse" : "research-topic";
  return [
    `<section class="${sectionClass}">`,
    '    <div class="research-text">',
    // 見出しは <br> を含むためHTMLのまま出す。
    `        <h2>${pick(topic.heading, lang)}</h2>`,
    pick(topic.body, lang),
    "    </div>",
    imageHtml(topic.image, lang),
    "</section>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** 研究紹介全体のHTMLを組み立てる。管理画面のプレビューもこの関数を使う。 */
export function researchHtml(data, lang) {
  const topics = data?.topics ?? [];
  // 区切り線はテーマの「間」にだけ入れる。末尾には付けない。
  return topics
    .map((topic, index) => topicHtml(topic, index, lang))
    .join('\n<hr class="research-divider">\n');
}

/** data/research.json を読む。 */
export async function loadResearch() {
  const response = await fetch(DATA_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`research.json の取得に失敗しました (${response.status})`);
  return response.json();
}

/** 研究紹介ページに描画する。 */
export function renderResearch(container, data, lang) {
  if (!container) return;
  container.innerHTML = researchHtml(data, lang);
}

/** ページ読み込み時の定型処理。失敗しても空白のページを見せない。 */
export async function mountResearch(container, lang) {
  try {
    renderResearch(container, await loadResearch(), lang);
  } catch (error) {
    console.error(error);
    container.innerHTML =
      lang === "en"
        ? '<p class="load-error">Could not load the research page. Please reload.</p>'
        : '<p class="load-error">研究内容を読み込めませんでした。時間をおいて再読み込みしてください。</p>';
  }
}
