/**
 * 引用ボックスの編集。
 *
 * 1つの引用は「本文」と「0個以上のリンク」でできている。
 * 移行した37記事のうち24記事が引用を持ち、うち1記事は引用が2つある。
 */

import { h } from "./dom.js";
import { EN_PLACEHOLDER } from "./controls.js";

const DEFAULT_LINK_LABEL = { ja: "論文を見る &rarr;", en: "View the paper &rarr;" };

function input(value, placeholder, onInput, mono = false) {
  return h("input", {
    type: "text",
    class: `input${mono ? " mono" : ""}`,
    value: value ?? "",
    placeholder,
    oninput: (event) => onInput(event.target.value),
  });
}

function linkRow(link, links, index, changed, lang) {
  return h(
    "div",
    { class: "link-row" },
    input(link.label?.[lang], lang === "en" ? EN_PLACEHOLDER : DEFAULT_LINK_LABEL.ja, (value) => {
      link.label = link.label ?? { ja: "", en: "" };
      link.label[lang] = value;
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
export function citationRow(citation, index, changed, onRemove, lang = "ja") {
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
      value: citation.text?.[lang] ?? "",
      spellcheck: false,
      placeholder:
        lang === "en" ? EN_PLACEHOLDER : "Sakai, F., Hirose, K., …, <i>誌名</i>, 巻, 頁, 年.",
      oninput: (event) => {
        citation.text = citation.text ?? { ja: "", en: "" };
        citation.text[lang] = event.target.value;
        changed();
      },
    }),
    ...links.map((link, linkIndex) => linkRow(link, links, linkIndex, changed, lang)),
    h(
      "button",
      {
        type: "button",
        class: "button ghost small",
        onclick: () => {
          links.push({ label: { ...DEFAULT_LINK_LABEL }, url: "" });
          changed({ rerender: true });
        },
      },
      "+ リンクを追加",
    ),
  );
}

/** 空の引用をつくる。 */
export function blankCitation() {
  return {
    text: { ja: "", en: "" },
    links: [{ label: { ...DEFAULT_LINK_LABEL }, url: "" }],
  };
}
