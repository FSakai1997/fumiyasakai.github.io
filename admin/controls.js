/**
 * 入力欄の生成。ニュース・CV・研究紹介の3つのフォームで共用する。
 *
 * 同じ関数を各フォームに書き写すと、片方だけ直したときに挙動が食い違う。
 */

import { h } from "./dom.js";

/** 英語欄が未入力のときに出す案内。フォーム間で文言を揃える。 */
export const EN_PLACEHOLDER = "(未入力なら日本語を表示します)";

/**
 * 1行の入力欄。
 * @param {object} options  type / placeholder / mono（等幅にするか）
 */
export function textInput(value, onInput, options = {}) {
  return h("input", {
    type: options.type ?? "text",
    class: `input${options.mono ? " mono" : ""}`,
    value: value ?? "",
    placeholder: options.placeholder ?? "",
    oninput: (event) => onInput(event.target.value),
  });
}

/** 複数行の入力欄。HTMLを直接書くため等幅にする。 */
export function textArea(value, onInput, options = {}) {
  return h("textarea", {
    class: "input textarea",
    rows: options.rows ?? 10,
    value: value ?? "",
    placeholder: options.placeholder ?? "",
    spellcheck: false,
    oninput: (event) => onInput(event.target.value),
  });
}

/** 日本語と English を行き来する切替タブ。 */
export function langTabs(current, onSwitch) {
  return h(
    "div",
    { class: "lang-tabs" },
    ...["ja", "en"].map((code) =>
      h(
        "button",
        {
          type: "button",
          class: `lang-tab${code === current ? " on" : ""}`,
          onclick: () => onSwitch(code),
        },
        code === "ja" ? "日本語" : "English",
      ),
    ),
  );
}

/** 一覧の行に並べる小さなボタン。 */
export function rowButton(label, title, enabled, onClick, extraClass = "") {
  return h("button", {
    class: `row-button ${extraClass}`.trim(),
    title,
    disabled: !enabled,
    textContent: label,
    onclick: (event) => {
      event.stopPropagation();
      onClick();
    },
  });
}
