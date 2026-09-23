/**
 * ブラウザを使わずに管理画面の描画を動かすための、最小限のDOM。
 *
 * 目的は見た目の検証ではなく、「描画関数が例外を投げずに最後まで走るか」を
 * 確かめること。実際に、input の list が読み取り専用であることに気づかず
 * ニュース編集タブ全体が開けなくなる不具合が出た。その種の不具合は
 * 構文チェックでは見つからない。
 *
 * ブラウザで本当に読み取り専用のプロパティは、ここでも読み取り専用にする。
 * そうしないと、再現すべき不具合を取り逃がす。
 */

/** ブラウザで getter しか持たないプロパティ。代入すると例外になる。 */
const READ_ONLY = {
  input: ["list", "form", "labels", "files", "validity"],
  select: ["form", "labels", "options"],
  textarea: ["form", "labels", "validity"],
  button: ["form", "labels"],
  option: ["form"],
};

/** 各タグで代入できるプロパティ。 */
const WRITABLE = {
  input: ["type", "value", "placeholder", "checked", "disabled", "accept", "multiple", "spellcheck"],
  textarea: ["value", "rows", "placeholder", "spellcheck", "disabled"],
  select: ["value", "disabled"],
  option: ["value", "selected"],
  button: ["disabled", "type", "title", "textContent"],
  img: ["src", "alt", "loading"],
  a: ["href", "target", "rel"],
  iframe: ["srcdoc", "className"],
};

class FakeClassList {
  constructor(el) {
    this.el = el;
  }
  get names() {
    return this.el.className.split(/\s+/).filter(Boolean);
  }
  set names(list) {
    this.el.className = list.join(" ");
  }
  add(name) {
    if (!this.contains(name)) this.names = [...this.names, name];
  }
  remove(name) {
    this.names = this.names.filter((n) => n !== name);
  }
  contains(name) {
    return this.names.includes(name);
  }
  toggle(name, force) {
    const want = force === undefined ? !this.contains(name) : force;
    if (want) this.add(name);
    else this.remove(name);
  }
}

export class FakeNode {
  constructor() {
    this.children = [];
  }
}

class FakeElement extends FakeNode {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.tag = tag;
    this.className = "";
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.style = {};
    this.classList = new FakeClassList(this);

    for (const key of WRITABLE[tag] ?? []) {
      Object.defineProperty(this, key, { value: "", writable: true, enumerable: true });
    }
    for (const key of READ_ONLY[tag] ?? []) {
      Object.defineProperty(this, key, { get: () => null, configurable: true, enumerable: true });
    }
  }

  setAttribute(key, value) {
    this.attributes[key] = String(value);
  }
  getAttribute(key) {
    return this.attributes[key] ?? null;
  }
  removeAttribute(key) {
    delete this.attributes[key];
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((c) => c !== this);
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }

  /** 登録されたイベントを発火させる。入力を模すのに使う。 */
  fire(type, event = {}) {
    for (const fn of this.listeners[type] ?? []) fn({ target: this, ...event });
  }

  /** 深さ優先で全要素をたどる。 */
  *walk() {
    for (const child of this.children) {
      if (child instanceof FakeElement) {
        yield child;
        yield* child.walk();
      }
    }
  }

  /** タグ名で最初の1つを探す。 */
  find(tag) {
    for (const el of this.walk()) if (el.tag === tag) return el;
    return null;
  }

  findAll(tag) {
    return [...this.walk()].filter((el) => el.tag === tag);
  }

  get text() {
    if (this.textContent) return String(this.textContent);
    return this.children
      .map((c) => (c instanceof FakeElement ? c.text : String(c.textContent ?? "")))
      .join("");
  }
}

/** グローバルに document を用意する。テストの先頭で1度だけ呼ぶ。 */
export function installFakeDom() {
  globalThis.Node = FakeNode;
  globalThis.document = {
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (text) => {
      const node = new FakeNode();
      node.nodeType = 3;
      node.textContent = String(text);
      return node;
    },
    body: new FakeElement("body"),
  };
  globalThis.confirm = () => true;
  return globalThis.document;
}

export { FakeElement };
