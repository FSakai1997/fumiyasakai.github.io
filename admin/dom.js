/**
 * DOM生成の小さな道具。
 *
 * フォームを文字列連結で組み立てると、利用者が入力した引用符やタグが
 * そのまま画面構造に混ざる。要素として組み立てれば、テキストは必ず
 * テキストとして扱われる。
 */

/**
 * 要素をつくる。
 *   h("div", { class: "row" }, "文字", h("span", {}, "子"))
 *
 * props の特別扱い:
 *   class   … className
 *   dataset … data-* 属性
 *   onXxx   … イベント購読
 *   html    … innerHTML（自分で組み立てたHTMLを入れるときだけ使う）
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  // value は子要素より後に設定する。<select> は <option> が入る前に
  // value を代入しても一致する選択肢がなく、黙って無視されるため。
  let deferredValue;

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "value") deferredValue = value;
    else if (key === "class") el.className = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else setProperty(el, key, value);
  }

  append(el, children);

  if (deferredValue !== undefined) setProperty(el, "value", deferredValue);
  return el;
}

/**
 * プロパティとして設定し、できなければ属性として設定する。
 *
 * DOM には「プロパティとしては存在するのに読み取り専用」のものがある。
 * たとえば input の list は、対応する datalist 要素を返すだけの getter で、
 * 代入すると例外になる（モジュールは strict mode で動くため無視されない）。
 */
function setProperty(el, key, value) {
  if (key in el) {
    try {
      el[key] = value;
      return;
    } catch {
      // 読み取り専用だった。属性で設定し直す。
    }
  }
  el.setAttribute(key, value);
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** 中身を入れ替える。 */
export function replace(parent, ...children) {
  parent.replaceChildren();
  return append(parent, children);
}

/** ラベルつきの入力欄。 */
export function field(labelText, control, hint) {
  return h(
    "label",
    { class: "field" },
    h("span", { class: "field-label" }, labelText),
    control,
    hint ? h("span", { class: "field-hint" }, hint) : null,
  );
}

/** 一定時間まとめてから実行する。入力のたびに再描画しないため。 */
export function debounce(fn, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

/** HTMLに文字列を差し込む前のエスケープ。 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
