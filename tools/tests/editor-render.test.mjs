/**
 * 編集フォームを実データで実際に描画して、例外が出ないことを確かめる。
 *
 * 構文チェックだけでは見つからない不具合を捕まえるための検証。
 * 実際に「input の list は読み取り専用」に気づかず、ニュース編集タブが
 * まったく開けない状態で公開してしまった。ここで37記事すべてと
 * CV全セクションを描画しておけば、同じ種類の取りこぼしを防げる。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { installFakeDom, FakeElement } from "./fake-dom.mjs";

installFakeDom();

const { renderNewsForm } = await import("../../admin/news-form.js");
const { renderSectionForm, renderProfileForm } = await import("../../admin/cv-form.js");

function load(name) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../../data/${name}`, import.meta.url)), "utf-8"));
}

const news = load("news.json");
const cv = load("cv.json");

function container() {
  return new FakeElement("div");
}

/**
 * ラベル名で入力欄を特定する。
 * 並び順に頼ると、似た欄を取り違えて検証が空振りする。
 */
function fieldControl(root, labelText, tag = "input") {
  for (const el of root.walk()) {
    if (el.tag !== "label") continue;
    const label = el.children.find((child) => child.classList?.contains("field-label"));
    if (label?.text === labelText) return el.find(tag);
  }
  return null;
}

/** ラベル名が一致する field-label の数。 */
function countFields(root, labelText) {
  return [...root.walk()].filter(
    (el) => el.classList?.contains("field-label") && el.text === labelText,
  ).length;
}

const noop = () => {};

test("37記事すべての編集フォームが例外なく描画できる", () => {
  for (const item of news.items) {
    const root = container();
    assert.doesNotThrow(
      () =>
        renderNewsForm(root, structuredClone(item), {
          onChange: noop,
          tagOptions: ["Publication", "Award"],
          onPickImage: noop,
        }),
      `${item.date} ${item.ja.title} の描画で例外`,
    );
    assert.ok(root.children.length > 0, "何も描画されていない");
  }
});

test("タグ入力欄の list は属性として付く（読み取り専用プロパティの回避）", () => {
  const root = container();
  renderNewsForm(root, structuredClone(news.items[0]), { onChange: noop, tagOptions: ["Award"] });
  const withList = [...root.walk()].find((el) => el.getAttribute("list"));
  assert.ok(withList, "list 属性を持つ要素がない");
  assert.equal(withList.getAttribute("list"), "news-tag-options");
});

test("画像つき記事では画像欄が描画される", () => {
  const withImage = news.items.find((item) => item.image);
  const root = container();
  renderNewsForm(root, structuredClone(withImage), { onChange: noop, tagOptions: [] });
  const img = root.find("img");
  assert.ok(img, "画像のサムネイルがない");
  assert.match(img.src, /^\.\.\/image\//);
});

test("画像のない記事では「画像を追加」ボタンが出る", () => {
  const withoutImage = news.items.find((item) => !item.image);
  const root = container();
  renderNewsForm(root, structuredClone(withoutImage), { onChange: noop, tagOptions: [] });
  assert.ok(root.findAll("button").some((b) => b.text.includes("画像を追加")));
});

test("引用が2件ある記事では引用欄が2つ出る", () => {
  const twoCitations = news.items.find((item) => (item.citations ?? []).length === 2);
  const root = container();
  renderNewsForm(root, structuredClone(twoCitations), { onChange: noop, tagOptions: [] });
  const heads = [...root.walk()].filter((el) => el.classList.contains("row-index"));
  assert.equal(heads.length, 2);
});

test("本文を書き換えると onChange が呼ばれ、item に反映される", () => {
  const item = structuredClone(news.items[0]);
  let called = 0;
  const root = container();
  renderNewsForm(root, item, { onChange: () => called++, tagOptions: [] });

  const bodyArea = root.findAll("textarea").find((el) => el.value === item.ja.body);
  assert.ok(bodyArea, "本文のテキストエリアが見つからない");

  bodyArea.value = "<p>書き換えました</p>";
  bodyArea.fire("input");

  assert.equal(item.ja.body, "<p>書き換えました</p>");
  assert.ok(called > 0, "onChange が呼ばれていない");
});

test("英語タブに切り替えても例外が出ず、英語欄を編集できる", () => {
  const item = structuredClone(news.items[0]);
  const root = container();
  renderNewsForm(root, item, { onChange: noop, tagOptions: [], lang: "en" });

  const titleInput = fieldControl(root, "タイトル");
  assert.ok(titleInput, "英語タイトル欄が見つからない");
  titleInput.value = "A co-authored paper";
  titleInput.fire("input");
  assert.equal(item.en.title, "A co-authored paper");
  assert.equal(item.ja.title, news.items[0].ja.title, "日本語が上書きされている");
});

test("CVの全セクションが例外なく描画できる", () => {
  for (const section of cv.sections) {
    const root = container();
    assert.doesNotThrow(
      () =>
        renderSectionForm(root, structuredClone(section), {
          lang: "ja",
          onLangSwitch: noop,
          touch: noop,
          refresh: noop,
        }),
      `${section.heading} の描画で例外`,
    );
    assert.ok(root.children.length > 0);
  }
});

test("numbered セクションには日付欄を出さない", () => {
  const publications = cv.sections.find((s) => s.heading === "Publications");
  const root = container();
  renderSectionForm(root, structuredClone(publications), {
    lang: "ja",
    onLangSwitch: noop,
    touch: noop,
    refresh: noop,
  });
  assert.equal(countFields(root, "日付"), 0);
});

test("dated セクションには日付欄を出す", () => {
  const education = cv.sections.find((s) => s.heading === "Education");
  const root = container();
  renderSectionForm(root, structuredClone(education), {
    lang: "ja",
    onLangSwitch: noop,
    touch: noop,
    refresh: noop,
  });
  assert.equal(countFields(root, "日付"), education.entries.length);
});

test("Profile フォームが描画でき、箇条書きを行単位で編集できる", () => {
  const profile = structuredClone(cv.profile);
  const root = container();
  renderProfileForm(root, profile, { lang: "ja", onLangSwitch: noop, touch: noop });

  const lines = root.find("textarea");
  assert.ok(lines);
  lines.value = "一行目\n二行目\n\n";
  lines.fire("input");
  assert.deepEqual(profile.ja.lines, ["一行目", "二行目"], "空行が残っている");
});
