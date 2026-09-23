/**
 * ニュース編集タブ。
 *
 * 左に記事一覧、中央に編集フォーム、右にライブプレビュー。
 * プレビューは公開ページと同じ newsCardHtml を使うので、
 * 見えているものがそのまま公開される。
 */

import { h, replace } from "./dom.js";
import { JsonStore, ConflictError, commitMessage } from "./store.js";
import { Preview } from "./preview.js";
import { renderNewsForm } from "./news-form.js";
import { pickImage } from "./media.js";
import { newsCardHtml } from "../js/render-news.js";
import { archiveDate } from "../js/format.js";
import { pickTitle } from "../js/i18n.js";

const PATH = "data/news.json";

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function newId(date) {
  return `${date}-${Math.random().toString(36).slice(2, 6)}`;
}

function blankItem() {
  const date = todayIso();
  return {
    id: newId(date),
    date,
    dateLabel: "",
    tag: "News",
    draft: true,
    ja: { title: "", body: "<p></p>" },
    en: { title: "", body: "" },
    image: null,
    citations: [],
  };
}

export async function initNewsEditor(container, api) {
  const store = new JsonStore(api, PATH, (data) => data.items.length);
  await store.load();

  const preview = new Preview("news-preview");
  let selectedIndex = 0;

  const listEl = h("div", { class: "list-body" });
  const formEl = h("div", { class: "form-body" });
  const statusEl = h("span", { class: "status mono" });
  const saveButton = h("button", { class: "button primary small", onclick: () => save() }, "保存する");

  store.onDirtyChange = (dirty) => {
    statusEl.textContent = dirty ? "未保存の変更があります" : "保存済み";
    statusEl.classList.toggle("dirty", dirty);
  };
  store.onDirtyChange(false);

  const items = () => store.data.items;

  function tagOptions() {
    return [...new Set(items().map((item) => item.tag).filter(Boolean))].sort();
  }

  function touch() {
    store.setDirty(true);
  }

  function renderPreview() {
    const item = items()[selectedIndex];
    preview.update(item ? newsCardHtml(item, "ja") : "");
  }

  function renderList() {
    replace(
      listEl,
      ...items().map((item, index) =>
        h(
          "div",
          {
            class: `list-row${index === selectedIndex ? " on" : ""}${item.draft ? " is-draft" : ""}`,
            onclick: () => select(index),
          },
          h(
            "div",
            { class: "list-main" },
            h("span", { class: "list-date mono" }, archiveDate(item)),
            h("span", { class: "list-title" }, pickTitle(item, "ja") || "（無題）"),
          ),
          h(
            "div",
            { class: "list-meta" },
            h("span", { class: "list-tag" }, item.tag || "—"),
            item.draft ? h("span", { class: "draft-badge" }, "下書き") : null,
          ),
          h(
            "div",
            { class: "list-actions" },
            rowButton("↑", "上へ", index > 0, () => move(index, -1)),
            rowButton("↓", "下へ", index < items().length - 1, () => move(index, 1)),
            rowButton("複製", "複製", true, () => duplicate(index)),
            rowButton("削除", "削除", true, () => remove(index), "danger"),
          ),
        ),
      ),
    );
  }

  function rowButton(label, title, enabled, onClick, extra = "") {
    return h("button", {
      class: `row-button ${extra}`,
      title,
      disabled: !enabled,
      onclick: (event) => {
        event.stopPropagation();
        onClick();
      },
      textContent: label,
    });
  }

  function renderForm() {
    const item = items()[selectedIndex];
    if (!item) {
      replace(formEl, h("p", { class: "placeholder" }, "記事を選んでください"));
      return;
    }
    renderNewsForm(formEl, item, {
      tagOptions: tagOptions(),
      onPickImage: () => pickImage(api),
      onChange: ({ listDirty = true } = {}) => {
        touch();
        if (listDirty) renderList();
        renderPreview();
      },
    });
  }

  function select(index) {
    selectedIndex = index;
    renderList();
    renderForm();
    renderPreview();
  }

  function move(index, direction) {
    const list = items();
    const target = index + direction;
    [list[index], list[target]] = [list[target], list[index]];
    if (selectedIndex === index) selectedIndex = target;
    else if (selectedIndex === target) selectedIndex = index;
    touch();
    renderList();
  }

  function duplicate(index) {
    const copy = structuredClone(items()[index]);
    copy.id = newId(copy.date);
    copy.draft = true;
    copy.ja.title = `${copy.ja.title}（複製）`;
    items().splice(index + 1, 0, copy);
    touch();
    select(index + 1);
  }

  function remove(index) {
    const title = pickTitle(items()[index], "ja") || "（無題）";
    if (!confirm(`「${title}」を削除します。よろしいですか。\n\n保存するまで公開サイトは変わりません。`)) {
      return;
    }
    items().splice(index, 1);
    touch();
    select(Math.min(selectedIndex, items().length - 1));
  }

  function create() {
    items().unshift(blankItem());
    touch();
    select(0);
  }

  async function save() {
    const { before, after, delta } = store.countChange();

    let question = `記事を保存します。\n\n件数: ${before}件 → ${after}件`;
    if (delta < 0) question += `\n\n${Math.abs(delta)}件 減ります。意図した削除か確認してください。`;
    question += "\n\n保存すると、1〜2分後に公開サイトへ反映されます。";
    if (!confirm(question)) return;

    saveButton.disabled = true;
    saveButton.textContent = "保存しています…";
    try {
      const result = await store.save(commitMessage("news"));
      showResult(
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
        showConflict(error);
      } else {
        showResult(`保存できませんでした: ${error.message}`, "error");
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "保存する";
    }
  }

  const noticeEl = h("div", { class: "notice", hidden: true });

  function showResult(content, kind) {
    noticeEl.hidden = false;
    noticeEl.className = `notice ${kind}`;
    replace(noticeEl, content);
    if (kind === "ok") setTimeout(() => (noticeEl.hidden = true), 12000);
  }

  function showConflict(error) {
    showResult(
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
          h("span", { class: "column-title" }, "記事"),
          h("button", { class: "button small", onclick: create }, "+ 新規"),
        ),
        listEl,
      ),
      h(
        "section",
        { class: "column form-column" },
        h(
          "div",
          { class: "column-head" },
          h("span", { class: "column-title" }, "編集"),
          statusEl,
          saveButton,
        ),
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
