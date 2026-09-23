/**
 * CVのエントリ編集フォーム。
 *
 * セクションの型は2つ。
 *   dated    … 日付と内容 (Education, Awards, Lectures など)
 *   numbered … 連番リスト (Publications, Presentations など)。日付欄は出さない。
 */

import { h, replace, field } from "./dom.js";
import { textInput, textArea, langTabs, EN_PLACEHOLDER } from "./controls.js";

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
          textInput(
            entry.date,
            (value) => {
              entry.date = value;
              touch();
            },
            { placeholder: "2026.04 - 2029.03", mono: true },
          ),
        )
      : null,
    textArea(
      entry[lang],
      (value) => {
        entry[lang] = value;
        touch();
      },
      { rows: section.type === "numbered" ? 4 : 2, placeholder: lang === "en" ? EN_PLACEHOLDER : "" },
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
      textInput(
        box.name,
        (value) => {
          box.name = value;
          touch();
        },
        { placeholder: lang === "en" ? EN_PLACEHOLDER : "坂井 郁哉 (Fumiya Sakai)" },
      ),
    ),
    field(
      "箇条書き（1行に1項目）",
      textArea(
        (box.lines ?? []).join("\n"),
        (value) => {
          box.lines = value.split("\n").filter((line) => line.trim() !== "");
          touch();
        },
        { rows: 5 },
      ),
    ),
  );
}
