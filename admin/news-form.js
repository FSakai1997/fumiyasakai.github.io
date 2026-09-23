/**
 * ニュース記事1件の編集フォーム。
 *
 * 入力のたびに item を直接書き換え、onChange を呼ぶ。
 * 呼び出し側はそれを受けてプレビューと一覧を更新する。
 */

import { h, replace, field } from "./dom.js";
import { textInput, textArea, langTabs } from "./controls.js";
import { citationRow, blankCitation } from "./citation-editor.js";

/** 本文で使えるタグの早見表。毎回調べずに済むよう、フォームの下に置く。 */
const TAG_CHEATSHEET = [
  ["段落", "<p>…</p>"],
  ["改行", "<br>"],
  ["斜体（誌名）", "<i>…</i>"],
  ["太字（自分の名前）", "<strong>…</strong>"],
  ["リンク", '<a href="URL" target="_blank">表示文字</a>'],
];

/**
 * フォームを描画する。
 *
 * @param {HTMLElement} container
 * @param {object} item            編集対象。直接書き換える。
 * @param {object} options
 *   onChange({rerender}) 変更を通知する
 *   tagOptions           タグ候補
 *   onPickImage()        画像タブから選ぶ。Promise<string|null> を返す
 */
export function renderNewsForm(container, item, options) {
  const { onChange, tagOptions = [], onPickImage } = options;
  let lang = options.lang ?? "ja";

  const rerender = () => renderNewsForm(container, item, { ...options, lang });
  const changed = (opts = {}) => {
    onChange(opts);
    if (opts.rerender) rerender();
  };

  const image = item.image ?? null;

  replace(
    container,

    h(
      "div",
      { class: "form-grid two" },
      field(
        "日付",
        textInput(item.date, (value) => {
          item.date = value;
          changed();
        }, { type: "date" }),
        "並べ替えと年の分類に使います",
      ),
      field(
        "タグ",
        h(
          "input",
          {
            class: "input",
            list: "news-tag-options",
            value: item.tag ?? "",
            oninput: (event) => {
              item.tag = event.target.value;
              changed();
            },
          },
        ),
        "記事の右上に出る分類",
      ),
    ),

    h("datalist", { id: "news-tag-options" }, ...tagOptions.map((tag) => h("option", { value: tag }))),

    field(
      "日付の表示（期間のとき）",
      textInput(item.dateLabel, (value) => {
        item.dateLabel = value;
        changed();
      }, { placeholder: "例 2023.12.11-15", mono: true }),
      "空なら上の日付から自動で作ります。学会参加など期間のある記事だけ入力してください",
    ),

    h(
      "div",
      { class: "section-head" },
      h("span", {}, "本文"),
      langTabs(lang, (next) => {
        lang = next;
        rerender();
      }),
    ),

    field(
      "タイトル",
      textInput(item[lang]?.title, (value) => {
        item[lang] = item[lang] ?? { title: "", body: "" };
        item[lang].title = value;
        changed();
      }, { placeholder: lang === "ja" ? "共著論文が出版されました" : "(未入力なら日本語を表示します)" }),
    ),

    field(
      "本文（HTML）",
      textArea(
        item[lang]?.body,
        (value) => {
          item[lang] = item[lang] ?? { title: "", body: "" };
          item[lang].body = value;
          changed();
        },
        { rows: 14 },
      ),
    ),

    h(
      "details",
      { class: "cheatsheet" },
      h("summary", {}, "本文で使えるタグ"),
      h(
        "table",
        { class: "cheat-table" },
        ...TAG_CHEATSHEET.map(([name, code]) =>
          h("tr", {}, h("td", {}, name), h("td", {}, h("code", {}, code))),
        ),
      ),
    ),

    h("div", { class: "section-head" }, h("span", {}, "画像")),

    image
      ? h(
          "div",
          { class: "image-editor" },
          h("div", { class: "image-thumb" }, h("img", { src: `../${image.src}`, alt: "" })),
          h(
            "div",
            { class: "image-fields" },
            field("ファイル", textInput(image.src, (value) => {
              image.src = value;
              changed({ rerender: true });
            }, { mono: true })),
            field("代替テキスト", textInput(image.alt, (value) => {
              image.alt = value;
              changed();
            }, { placeholder: "画像の説明" })),
            h(
              "div",
              { class: "form-grid two" },
              field(
                "配置",
                h(
                  "select",
                  {
                    class: "input",
                    value: image.layout ?? "side",
                    onchange: (event) => {
                      image.layout = event.target.value;
                      changed();
                    },
                  },
                  h("option", { value: "side" }, "本文の左に並べる"),
                  h("option", { value: "center" }, "本文の上に中央寄せ"),
                ),
              ),
              field("幅", textInput(image.width, (value) => {
                if (value) image.width = value;
                else delete image.width;
                changed();
              }, { placeholder: "75%", mono: true })),
            ),
            h(
              "div",
              { class: "button-row" },
              onPickImage
                ? h(
                    "button",
                    {
                      type: "button",
                      class: "button small",
                      onclick: async () => {
                        const picked = await onPickImage();
                        if (picked) {
                          image.src = picked;
                          changed({ rerender: true });
                        }
                      },
                    },
                    "画像を選ぶ",
                  )
                : null,
              h(
                "button",
                {
                  type: "button",
                  class: "button ghost small danger",
                  onclick: () => {
                    item.image = null;
                    changed({ rerender: true });
                  },
                },
                "画像を外す",
              ),
            ),
          ),
        )
      : h(
          "button",
          {
            type: "button",
            class: "button small",
            onclick: () => {
              item.image = { src: "", alt: "", layout: "side" };
              changed({ rerender: true });
            },
          },
          "+ 画像を追加",
        ),

    h("div", { class: "section-head" }, h("span", {}, "引用ボックス")),

    ...(item.citations ?? []).map((citation, index) =>
      citationRow(citation, index, changed, () => {
        item.citations.splice(index, 1);
        changed({ rerender: true });
      }),
    ),

    h(
      "button",
      {
        type: "button",
        class: "button small",
        onclick: () => {
          item.citations = item.citations ?? [];
          item.citations.push(blankCitation());
          changed({ rerender: true });
        },
      },
      "+ 引用を追加",
    ),

    h(
      "label",
      { class: "checkbox draft-toggle" },
      h("input", {
        type: "checkbox",
        checked: Boolean(item.draft),
        onchange: (event) => {
          item.draft = event.target.checked;
          changed({ rerender: true });
        },
      }),
      h("span", {}, "下書きにする", h("em", { class: "caution" }, "下書きは公開ページに出ません")),
    ),
  );
}
