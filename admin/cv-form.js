/**
 * CVのエントリ編集フォーム。
 *
 * セクションの型は2つ。
 *   dated    … 日付と内容 (Education, Awards, Lectures など)
 *   numbered … 連番リスト (Publications, Presentations など)。日付欄は出さない。
 */

import { h, replace, field } from "./dom.js";

function textArea(value, rows, placeholder, onInput) {
  return h("textarea", {
    class: "input textarea",
    rows,
    value: value ?? "",
    placeholder,
    spellcheck: false,
    oninput: (event) => onInput(event.target.value),
  });
}

function textInput(value, placeholder, onInput, mono = false) {
  return h("input", {
    type: "text",
    class: `input${mono ? " mono" : ""}`,
    value: value ?? "",
    placeholder,
    oninput: (event) => onInput(event.target.value),
  });
}

const EN_PLACEHOLDER = "(未入力なら日本語を表示します)";

/** 言語の切替タブ。 */
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

function moveButton(label, title, enabled, onClick) {
  return h("button", { class: "row-button", title, disabled: !enabled, textContent: label, onclick: onClick });
}

/** エントリ1件分の編集欄。 */
function entryRow(section, index, lang, touch, refresh) {
  const entries = section.entries;
  const entry = entries[index];

  const swap = (other) => {
    [entries[other], entries[index]] = [entries[index], entries[other]];
    touch();
    refresh();
  };

  return h(
    "div",
    { class: "citation-row" },
    h(
      "div",
      { class: "citation-head" },
      h("span", { class: "row-index mono" }, String(index + 1)),
      h(
        "div",
        { class: "row-move" },
        moveButton("↑", "上へ", index > 0, () => swap(index - 1)),
        moveButton("↓", "下へ", index < entries.length - 1, () => swap(index + 1)),
      ),
      h(
        "button",
        {
          class: "button ghost small danger",
          onclick: () => {
            if (!confirm("この項目を削除します。よろしいですか。\n\n保存するまで公開サイトは変わりません。")) return;
            entries.splice(index, 1);
            touch();
            refresh();
          },
        },
        "削除",
      ),
    ),
    section.type === "dated"
      ? field(
          "日付",
          textInput(entry.date, "2026.04 - 2029.03", (value) => {
            entry.date = value;
            touch();
          }, true),
        )
      : null,
    textArea(
      entry[lang],
      section.type === "numbered" ? 4 : 2,
      lang === "en" ? EN_PLACEHOLDER : "",
      (value) => {
        entry[lang] = value;
        touch();
      },
    ),
  );
}

/** セクション1つ分のフォームを描く。 */
export function renderSectionForm(container, section, options) {
  const { lang, onLangSwitch, touch, refresh } = options;

  replace(
    container,
    h("div", { class: "section-head" }, h("span", {}, section.heading), langTabs(lang, onLangSwitch)),
    ...section.entries.map((_, index) => entryRow(section, index, lang, touch, refresh)),
    h(
      "button",
      {
        class: "button small",
        onclick: () => {
          section.entries.push({ date: "", ja: "", en: "" });
          touch();
          refresh();
        },
      },
      "+ 項目を追加",
    ),
  );
}

/** Profile セクションのフォームを描く。 */
export function renderProfileForm(container, profile, options) {
  const { lang, onLangSwitch, touch } = options;
  const box = profile[lang] ?? (profile[lang] = { name: "", lines: [] });

  replace(
    container,
    h("div", { class: "section-head" }, h("span", {}, "Profile"), langTabs(lang, onLangSwitch)),
    field(
      "氏名",
      textInput(box.name, lang === "en" ? EN_PLACEHOLDER : "坂井 郁哉 (Fumiya Sakai)", (value) => {
        box.name = value;
        touch();
      }),
    ),
    field(
      "箇条書き（1行に1項目）",
      textArea((box.lines ?? []).join("\n"), 5, "", (value) => {
        box.lines = value.split("\n").filter((line) => line.trim() !== "");
        touch();
      }),
    ),
  );
}
