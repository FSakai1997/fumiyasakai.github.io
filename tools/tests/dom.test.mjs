/**
 * DOM生成ヘルパー h() の検証。
 *
 * ブラウザを使わず、最小限のDOMを模して検証する。
 * 実際に起きた不具合を再現できる形にしてある:
 *   input の list プロパティは読み取り専用で、代入すると
 *   「Cannot set property list ... which has only a getter」で落ちる。
 *   これによりニュース編集タブ全体が開けなくなった。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

/** 最小限の要素。実ブラウザの「読み取り専用プロパティ」を再現する。 */
function createElement(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    className: "",
    attributes: {},
    children: [],
    dataset: {},
    listeners: {},
    setAttribute(key, value) {
      this.attributes[key] = String(value);
    },
    getAttribute(key) {
      return this.attributes[key] ?? null;
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = [...nodes];
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
  };

  if (tag === "input") {
    // 本物の input と同じく、list は getter だけを持つ。
    Object.defineProperty(el, "list", {
      get: () => null,
      configurable: true,
      enumerable: true,
    });
    for (const key of ["type", "value", "placeholder", "checked", "disabled"]) {
      Object.defineProperty(el, key, { value: "", writable: true, enumerable: true });
    }
  }

  if (tag === "select") {
    let stored = "";
    Object.defineProperty(el, "value", {
      get: () => stored,
      set(next) {
        // value が設定された時点の子要素数を記録する。
        el.childCountAtValueSet = el.children.length;
        stored = next;
      },
      configurable: true,
      enumerable: true,
    });
  }

  return el;
}

globalThis.document = {
  createElement,
  createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
};
globalThis.Node = class Node {};

const { h, escapeHtml } = await import("../../admin/dom.js");

test("読み取り専用のプロパティは属性として設定する（list の不具合の再現）", () => {
  const el = h("input", { list: "news-tag-options" });
  assert.equal(el.getAttribute("list"), "news-tag-options");
});

test("書き込めるプロパティはプロパティとして設定する", () => {
  const el = h("input", { type: "date", placeholder: "例" });
  assert.equal(el.type, "date");
  assert.equal(el.placeholder, "例");
});

test("class は className になる", () => {
  assert.equal(h("div", { class: "row on" }).className, "row on");
});

test("未知の属性は setAttribute で付く", () => {
  const el = h("div", { role: "tabpanel", "aria-selected": "true" });
  assert.equal(el.getAttribute("role"), "tabpanel");
  assert.equal(el.getAttribute("aria-selected"), "true");
});

test("onXxx はイベント購読になり、属性にはならない", () => {
  const fn = () => {};
  const el = h("button", { onclick: fn });
  assert.equal(el.listeners.click, fn);
  assert.equal(el.getAttribute("onclick"), null);
});

test("null / undefined / false の props は無視する", () => {
  const el = h("div", { hidden: false, title: null, id: undefined });
  assert.deepEqual(el.attributes, {});
});

test("select の value は子要素を入れた後に設定する", () => {
  // 先に value を入れると、一致する option がなく黙って無視される。
  const el = h(
    "select",
    { value: "center" },
    h("option", { value: "side" }),
    h("option", { value: "center" }),
  );
  assert.equal(el.childCountAtValueSet, 2, "子要素より先に value が設定されている");
  assert.equal(el.value, "center");
});

test("文字列の子はテキストノードになる（タグとして解釈されない）", () => {
  const el = h("div", {}, "<script>alert(1)</script>");
  assert.equal(el.children.length, 1);
  assert.equal(el.children[0].nodeType, 3);
  assert.equal(el.children[0].textContent, "<script>alert(1)</script>");
});

test("入れ子の配列も平らにして追加する", () => {
  const el = h("div", {}, ["a", ["b", "c"]], null, false);
  assert.equal(el.children.length, 3);
});

test("escapeHtml は記号を無害にする", () => {
  assert.equal(escapeHtml('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});
