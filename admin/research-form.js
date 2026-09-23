/**
 * 研究テーマ1件の編集フォーム。
 *
 * 入力のたびに topic を直接書き換え、onChange を呼ぶ。
 * 呼び出し側はそれを受けてプレビューと一覧を更新する。
 */

import { h, replace, field } from "./dom.js";
import { textInput, textArea, langTabs, EN_PLACEHOLDER } from "./controls.js";

/**
 * @param {HTMLElement} container
 * @param {object} topic    編集対象。直接書き換える。
 * @param {object} options
 *   lang                 "ja" | "en"
 *   onLangSwitch(lang)   言語タブの切替
 *   onChange({rerender}) 変更を通知する
 *   onPickImage()        画像タブから選ぶ。Promise<string|null> を返す
 */
export function renderTopicForm(container, topic, options) {
  const { lang, onLangSwitch, onChange, onPickImage } = options;
  const changed = (opts = {}) => onChange(opts);
  const image = topic.image ?? null;

  replace(
    container,

    h(
      "div",
      { class: "section-head" },
      h("span", {}, "研究テーマ"),
      langTabs(lang, onLangSwitch),
    ),

    field(
      "見出し",
      textInput(
        topic.heading?.[lang],
        (value) => {
          topic.heading = topic.heading ?? { ja: "", en: "" };
          topic.heading[lang] = value;
          changed();
        },
        { placeholder: lang === "en" ? EN_PLACEHOLDER : "地球コアの組成決定：<br>軽元素の分配挙動の解明" },
      ),
      "改行したい位置に <br> を入れられます",
    ),

    field(
      "本文（HTML）",
      textArea(
        topic.body?.[lang],
        (value) => {
          topic.body = topic.body ?? { ja: "", en: "" };
          topic.body[lang] = value;
          changed();
        },
        { rows: 16, placeholder: lang === "en" ? EN_PLACEHOLDER : "<p>段落</p>" },
      ),
      "段落ごとに <p>…</p> で囲みます",
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
            field(
              "ファイル",
              textInput(
                image.src,
                (value) => {
                  image.src = value;
                  changed({ rerender: true });
                },
                { mono: true },
              ),
            ),
            field(
              "代替テキスト",
              textInput(
                image.alt,
                (value) => {
                  image.alt = value;
                  changed();
                },
                { placeholder: "画像の説明（言語を問わず共通）" },
              ),
            ),
            field(
              "キャプション",
              textInput(
                image.caption?.[lang],
                (value) => {
                  image.caption = image.caption ?? { ja: "", en: "" };
                  image.caption[lang] = value;
                  changed();
                },
                { placeholder: lang === "en" ? EN_PLACEHOLDER : "画像の下に出る説明" },
              ),
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
                    topic.image = null;
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
              topic.image = { src: "", alt: "", caption: { ja: "", en: "" } };
              changed({ rerender: true });
            },
          },
          "+ 画像を追加",
        ),
  );
}

/** 新しい研究テーマの雛形。 */
export function blankTopic() {
  return {
    id: `topic-${Math.random().toString(36).slice(2, 6)}`,
    heading: { ja: "", en: "" },
    body: { ja: "<p></p>", en: "" },
    image: { src: "", alt: "", caption: { ja: "", en: "" } },
  };
}
