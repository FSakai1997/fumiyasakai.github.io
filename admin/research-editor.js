/**
 * 研究紹介の編集タブ。
 *
 * 左にテーマ一覧、中央に編集フォーム、右にライブプレビュー。
 * プレビューは公開ページと同じ researchHtml を使う。
 */

import { h, replace } from "./dom.js";
import { rowButton } from "./controls.js";
import { JsonStore, ConflictError, commitMessage } from "./store.js";
import { Preview } from "./preview.js";
import { renderTopicForm, blankTopic } from "./research-form.js";
import { pickImage } from "./media.js";
import { researchHtml } from "../js/render-research.js";

const PATH = "data/research.json";

/** 見出しはHTMLを含むので、一覧にはタグを外して出す。 */
function plainHeading(topic) {
  const text = String(topic.heading?.ja ?? "").replace(/<[^>]+>/g, " ").trim();
  return text || "（無題）";
}

export async function initResearchEditor(container, api) {
  const store = new JsonStore(api, PATH, (data) => data.topics.length);
  await store.load();

  const preview = new Preview("research-preview");
  let selected = 0;
  let lang = "ja";

  const listEl = h("div", { class: "list-body" });
  const formEl = h("div", { class: "form-body" });
  const statusEl = h("span", { class: "status mono" });
  const noticeEl = h("div", { class: "notice", hidden: true });
  const saveButton = h("button", { class: "button primary small", onclick: () => save() }, "保存する");

  store.onDirtyChange = (dirty) => {
    statusEl.textContent = dirty ? "未保存の変更があります" : "保存済み";
    statusEl.classList.toggle("dirty", dirty);
  };
  store.onDirtyChange(false);

  const topics = () => store.data.topics;

  function renderPreview() {
    preview.update(researchHtml(store.data, lang));
  }

  function touch() {
    store.setDirty(true);
    renderPreview();
  }

  function renderList() {
    replace(
      listEl,
      ...topics().map((topic, index) =>
        h(
          "div",
          {
            class: `list-row${index === selected ? " on" : ""}`,
            onclick: () => select(index),
          },
          h("div", { class: "list-main" }, h("span", { class: "list-title" }, plainHeading(topic))),
          h(
            "div",
            { class: "list-actions" },
            rowButton("↑", "上へ", index > 0, () => move(index, -1)),
            rowButton("↓", "下へ", index < topics().length - 1, () => move(index, 1)),
            rowButton("削除", "削除", true, () => remove(index), "danger"),
          ),
        ),
      ),
    );
  }

  function renderForm() {
    const topic = topics()[selected];
    if (!topic) {
      replace(formEl, h("p", { class: "placeholder" }, "テーマを選んでください"));
      return;
    }
    renderTopicForm(formEl, topic, {
      lang,
      onLangSwitch: (code) => {
        lang = code;
        renderForm();
        renderPreview();
      },
      onPickImage: () => pickImage(api),
      onChange: ({ rerender = false } = {}) => {
        touch();
        renderList();
        if (rerender) renderForm();
      },
    });
  }

  function select(index) {
    selected = index;
    renderList();
    renderForm();
    renderPreview();
  }

  function move(index, direction) {
    const list = topics();
    const target = index + direction;
    [list[index], list[target]] = [list[target], list[index]];
    if (selected === index) selected = target;
    else if (selected === target) selected = index;
    touch();
    renderList();
  }

  function remove(index) {
    if (!confirm(`「${plainHeading(topics()[index])}」を削除します。よろしいですか。\n\n保存するまで公開サイトは変わりません。`)) {
      return;
    }
    topics().splice(index, 1);
    touch();
    select(Math.min(selected, topics().length - 1));
  }

  function create() {
    topics().push(blankTopic());
    touch();
    select(topics().length - 1);
  }

  function notify(content, kind) {
    noticeEl.hidden = false;
    noticeEl.className = `notice ${kind}`;
    replace(noticeEl, content);
    if (kind === "ok") setTimeout(() => (noticeEl.hidden = true), 12000);
  }

  async function save() {
    const { before, after, delta } = store.countChange();

    let question = `研究紹介を保存します。\n\nテーマ数: ${before}件 → ${after}件`;
    if (delta < 0) question += `\n\n${Math.abs(delta)}件 減ります。意図した削除か確認してください。`;
    question += "\n\n保存すると、1〜2分後に公開サイトへ反映されます。";
    if (!confirm(question)) return;

    saveButton.disabled = true;
    saveButton.textContent = "保存しています…";
    try {
      const result = await store.save(commitMessage("research"));
      notify(
        h(
          "span",
          {},
          "保存しました。1〜2分で公開サイトへ反映されます。 ",
          h("a", { href: result.commitUrl, target: "_blank", rel: "noopener" }, "コミットを見る →"),
        ),
        "ok",
      );
    } catch (error) {
      if (error instanceof ConflictError) {
        notify(
          h(
            "span",
            {},
            error.message + " ",
            h(
              "button",
              {
                class: "button ghost small",
                onclick: async () => {
                  await store.reload();
                  select(0);
                  noticeEl.hidden = true;
                },
              },
              "GitHubの最新内容を読み直す（手元の変更は失われます）",
            ),
          ),
          "error",
        );
      } else {
        notify(`保存できませんでした: ${error.message}`, "error");
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "保存する";
    }
  }

  replace(
    container,
    h(
      "div",
      { class: "editor-layout" },
      h(
        "aside",
        { class: "column list-column" },
        h(
          "div",
          { class: "column-head" },
          h("span", { class: "column-title" }, "テーマ"),
          h("button", { class: "button small", onclick: create }, "+ 新規"),
        ),
        listEl,
      ),
      h(
        "section",
        { class: "column form-column" },
        h("div", { class: "column-head" }, h("span", { class: "column-title" }, "編集"), statusEl, saveButton),
        noticeEl,
        formEl,
      ),
      h(
        "section",
        { class: "column preview-column" },
        h("div", { class: "column-head" }, h("span", { class: "column-title" }, "プレビュー")),
        preview.element,
      ),
    ),
  );

  select(0);
}
