/**
 * data/news.json からニュースを描画する。
 *
 * 生成するHTMLは、移行前の news.html と同じクラス構成を保つ。
 * style.css を変更せずに見た目を維持するため。
 *
 * newsCardHtml は管理画面のライブプレビューからも呼ばれる。
 * プレビューと本番が食い違わないよう、描画コードはここ1箇所に置く。
 */

import { archiveDate, recentDate, groupByYear } from "./format.js";
import { pick, pickTitle, pickBody } from "./i18n.js";

/** トップページの「Recent News」に出す件数。 */
export const RECENT_NEWS_LIMIT = 10;

/** これ以前の年はまとめて1グループにする。 */
const OLDEST_GROUPED_YEAR = 2022;

/** 先頭からこの数のグループを開いた状態で表示する。 */
const OPEN_GROUP_COUNT = 2;

// ページからの相対パスにすると /en/ 配下から呼んだときに壊れる。
// このモジュールは常に /js/ にあるので、モジュール自身の位置を基準に解決する。
const DATA_URL = new URL("../data/news.json", import.meta.url);

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
  const src = escapeAttribute(image.src);
  const alt = escapeAttribute(pick(image.alt, lang));
  const imgStyle = image.width ? ` style="width:${escapeAttribute(image.width)}"` : "";
  // layout: "center" は本文の上に中央寄せで大きく出す。
  // layout: "side" は news-body の has-image と組み合わせて本文の左に並べる。
  const divStyle = image.layout === "center" ? ' style="text-align:center;"' : "";
  return `<div class="news-image"${divStyle}><img src="${src}" alt="${alt}"${imgStyle}></div>`;
}

function citationsHtml(citations) {
  if (!citations || citations.length === 0) return "";
  const rows = citations
    .map((citation) => {
      const text = citation.text ? `<p>${citation.text}</p>` : "";
      const links = (citation.links ?? [])
        .map(
          (link) =>
            `<a href="${escapeAttribute(link.url)}" target="_blank" class="btn-sm">${link.label}</a>`,
        )
        .join("\n                        ");
      return text + (links ? `\n                        ${links}` : "");
    })
    .join("\n                        ");
  return `<div class="citation-box">\n                        ${rows}\n                    </div>`;
}

/**
 * 記事1件分のHTMLを組み立てる。
 * 管理画面のプレビューもこの関数を使う。
 */
export function newsCardHtml(item, lang) {
  const image = item.image;
  const bodyClass = image && image.layout === "side" ? "news-body has-image" : "news-body";
  return [
    '<article class="news-card">',
    `    <div class="news-meta"><span class="news-date">${escapeText(archiveDate(item))}</span><span class="news-tag">${escapeText(item.tag ?? "")}</span></div>`,
    `    <h3 class="news-title">${escapeText(pickTitle(item, lang))}</h3>`,
    `    <div class="${bodyClass}">`,
    imageHtml(image, lang),
    pickBody(item, lang),
    citationsHtml(item.citations),
    "    </div>",
    "</article>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function yearSectionHtml(group, isOpen) {
  const sign = isOpen ? "-" : "+";
  const activeClass = isOpen ? ' class="year-toggle active"' : ' class="year-toggle"';
  const display = isOpen ? "block" : "none";
  const cards = group.items.map((item) => newsCardHtml(item, group.lang)).join("\n");
  return (
    `<div${activeClass} data-target="${group.id}">${group.label} <span>${sign}</span></div>` +
    `<div id="${group.id}" class="year-archive" style="display: ${display};">\n${cards}\n</div>`
  );
}

function attachToggles(container) {
  for (const toggle of container.querySelectorAll(".year-toggle")) {
    toggle.addEventListener("click", () => {
      const content = container.querySelector(`#${CSS.escape(toggle.dataset.target)}`);
      if (!content) return;
      const willOpen = content.style.display === "none";
      content.style.display = willOpen ? "block" : "none";
      toggle.classList.toggle("active", willOpen);
      toggle.querySelector("span").textContent = willOpen ? "-" : "+";
    });
  }
}

function showError(container, message) {
  container.innerHTML = `<p class="load-error">${escapeText(message)}</p>`;
}

/** data/news.json を読み、下書きを除いた記事を返す。 */
export async function loadNews() {
  // 保存直後に古い内容が見えないよう、毎回サーバーに問い合わせる。
  const response = await fetch(DATA_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`news.json の取得に失敗しました (${response.status})`);
  const data = await response.json();
  return (data.items ?? []).filter((item) => !item.draft);
}

/** 一覧ページ（news.html）に年別アーカイブを描画する。 */
export function renderArchive(container, items, lang) {
  if (!container) return;
  const groups = groupByYear(items, OLDEST_GROUPED_YEAR);
  container.innerHTML = groups
    .map((group, index) => yearSectionHtml({ ...group, lang }, index < OPEN_GROUP_COUNT))
    .join("\n");
  attachToggles(container);
}

/** トップページ（index.html）の Recent News を描画する。 */
export function renderRecent(container, items, lang) {
  if (!container) return;
  container.innerHTML = items
    .slice(0, RECENT_NEWS_LIMIT)
    .map((item) => `<li>${escapeText(recentDate(item))} - ${escapeText(pickTitle(item, lang))}</li>`)
    .join("\n");
}

/** ページ読み込み時の定型処理。失敗しても空白のページを見せない。 */
export async function mountNews(container, render, lang) {
  try {
    const items = await loadNews();
    render(container, items, lang);
  } catch (error) {
    console.error(error);
    showError(container, "ニュースを読み込めませんでした。時間をおいて再読み込みしてください。");
  }
}
