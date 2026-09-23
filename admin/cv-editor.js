/**
 * CV編集タブ。
 *
 * 左にセクション一覧、中央にエントリ編集、右にライブプレビュー。
 *
 * セクション自体の追加・削除・並べ替えは作らない。CVの章立てはめったに
 * 変わらず、UIを作る労力に見合わない。必要になったら data/cv.json を
 * 直接編集すればよい。
 */

import { h, replace } from "./dom.js";
import { JsonStore, ConflictError, commitMessage } from "./store.js";
import { Preview } from "./preview.js";
import { renderSectionForm, renderProfileForm } from "./cv-form.js";
import { cvHtml } from "../js/render-cv.js";

const PATH = "data/cv.json";
const PROFILE = -1;

function countEntries(data) {
  return data.sections.reduce((sum, section) => sum + section.entries.length, 0);
}

export async function initCvEditor(container, api) {
  const store = new JsonStore(api, PATH, countEntries);
  await store.load();

  const preview = new Preview("cv-preview");
  let selected = PROFILE + 1;
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

  const sections = () => store.data.sections;

  function touch() {
    store.setDirty(true);
    preview.update(cvHtml(store.data, "ja"));
  }

  function listRow(label, index, note) {
    return h(
      "div",
      { class: `list-row${index === selected ? " on" : ""}`, onclick: () => select(index) },
      h("div", { class: "list-main" }, h("span", { class: "list-title" }, label)),
      note ? h("div", { class: "list-meta" }, h("span", { class: "list-tag" }, note)) : null,
    );
  }

  function renderList() {
    replace(
      listEl,
      listRow("Profile", PROFILE, null),
      ...sections().map((section, index) =>
        listRow(section.heading, index, `${section.entries.length} 件`),
      ),
    );
  }

  function renderForm() {
    const options = {
      lang,
      onLangSwitch: (code) => {
        lang = code;
        renderForm();
      },
      touch,
      refresh: renderForm,
    };

    if (selected === PROFILE) renderProfileForm(formEl, store.data.profile, options);
    else renderSectionForm(formEl, sections()[selected], options);
  }

  function select(index) {
    selected = index;
    renderList();
    renderForm();
  }

  function notify(content, kind) {
    noticeEl.hidden = false;
    noticeEl.className = `notice ${kind}`;
    replace(noticeEl, content);
    if (kind === "ok") setTimeout(() => (noticeEl.hidden = true), 12000);
  }

  function offerReload(error) {
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
              select(PROFILE + 1);
              noticeEl.hidden = true;
            },
          },
          "GitHubの最新内容を読み直す（手元の変更は失われます）",
        ),
      ),
      "error",
    );
  }

  async function save() {
    const { before, after, delta } = store.countChange();

    let question = `CVを保存します。\n\n項目数: ${before}件 → ${after}件`;
    if (delta < 0) question += `\n\n${Math.abs(delta)}件 減ります。意図した削除か確認してください。`;
    question += "\n\n保存すると、1〜2分後に公開サイトへ反映されます。";
    if (!confirm(question)) return;

    saveButton.disabled = true;
    saveButton.textContent = "保存しています…";
    try {
      const result = await store.save(commitMessage("cv"));
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
      if (error instanceof ConflictError) offerReload(error);
      else notify(`保存できませんでした: ${error.message}`, "error");
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
        h("div", { class: "column-head" }, h("span", { class: "column-title" }, "セクション")),
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

  select(PROFILE + 1);
  preview.render(cvHtml(store.data, "ja"));
}
