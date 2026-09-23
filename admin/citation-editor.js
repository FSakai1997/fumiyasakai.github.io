/**
 * 引用ボックスの編集。
 *
 * 1つの引用は「本文」と「0個以上のリンク」でできている。
 * 移行した37記事のうち24記事が引用を持ち、うち1記事は引用が2つある。
 */

import { h } from "./dom.js";

const DEFAULT_LINK_LABEL = "論文を見る &rarr;";

function input(value, placeholder, onInput, mono = false) {
  return h("input", {
    type: "text",
    class: `input${mono ? " mono" : ""}`,
    value: value ?? "",
    placeholder,
    oninput: (event) => onInput(event.target.value),
  });
}

function linkRow(link, links, index, changed) {
  return h(
    "div",
    { class: "link-row" },
    input(link.label, DEFAULT_LINK_LABEL, (value) => {
      link.label = value;
      changed();
    }),
    input(
      link.url,
      "https://doi.org/…",
      (value) => {
        link.url = value;
        changed();
      },
      true,
    ),
    h(
      "button",
      {
        type: "button",
        class: "button ghost small",
        title: "このリンクを削除",
        onclick: () => {
          links.splice(index, 1);
          changed({ rerender: true });
        },
      },
      "×",
    ),
  );
}

/** 引用1件分の編集欄。 */
export function citationRow(citation, index, changed, onRemove) {
  const links = citation.links ?? (citation.links = []);

  return h(
    "div",
    { class: "citation-row" },
    h(
      "div",
      { class: "citation-head" },
      h("span", { class: "row-index mono" }, `引用 ${index + 1}`),
      h("button", { type: "button", class: "button ghost small danger", onclick: onRemove }, "削除"),
    ),
    h("textarea", {
      class: "input textarea",
      rows: 3,
      value: citation.text ?? "",
      spellcheck: false,
      placeholder: "Sakai, F., Hirose, K., …, <i>誌名</i>, 巻, 頁, 年.",
      oninput: (event) => {
        citation.text = event.target.value;
        changed();
      },
    }),
    ...links.map((link, linkIndex) => linkRow(link, links, linkIndex, changed)),
    h(
      "button",
      {
        type: "button",
        class: "button ghost small",
        onclick: () => {
          links.push({ label: DEFAULT_LINK_LABEL, url: "" });
          changed({ rerender: true });
        },
      },
      "+ リンクを追加",
    ),
  );
}

/** 空の引用をつくる。 */
export function blankCitation() {
  return { text: "", links: [{ label: DEFAULT_LINK_LABEL, url: "" }] };
}
