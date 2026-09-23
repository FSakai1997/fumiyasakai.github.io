/**
 * 画像の一覧とアップロード。
 *
 * 画像は image/ に置き、記事からは "image/xxx.jpg" の形で参照する。
 * 公開ページもプレビューも同じ相対パスで解決する。
 *
 * 削除機能は作らない。記事から参照されている画像を消すと、
 * 記事側は壊れたまま静かに残る。リポジトリ上のわずかな容量より、
 * その事故を避けることを優先する。
 */

import { h, replace } from "./dom.js";
import { commitMessage } from "./store.js";

const DIR = "image";

/** GitHub Contents API は大きなファイルに向かない。読み込みも遅くなる。 */
const MAX_BYTES = 5 * 1024 * 1024;

const IMAGE_PATTERN = /\.(jpe?g|png|gif|webp|avif|svg)$/i;

/**
 * ファイル名を、URLで扱いやすい形に整える。
 * 日本語のファイル名はURLエンコードされて読みにくくなるため。
 */
export function safeFileName(name) {
  const match = /^(.*?)(\.[^.]+)?$/.exec(name);
  const stem = (match[1] || "image")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const extension = (match[2] || "").toLowerCase();
  return (stem || "image") + extension;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** data URL の「,」以降を取り出す。 */
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("ファイルを読み込めませんでした。"));
    reader.readAsDataURL(file);
  });
}

async function listImages(api) {
  const entries = await api.listDir(DIR);
  return entries
    .filter((entry) => entry.type === "file" && IMAGE_PATTERN.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 1ファイルをアップロードする。
 * @returns {Promise<{path: string, skipped?: boolean}>}
 */
async function upload(api, file, existing) {
  if (file.size > MAX_BYTES) {
    throw new Error(
      `${file.name} は ${formatSize(file.size)} あります。` +
        `${formatSize(MAX_BYTES)} 以下に縮小してから追加してください。`,
    );
  }

  const name = safeFileName(file.name);
  const path = `${DIR}/${name}`;
  const already = existing.find((entry) => entry.name === name);

  if (already && !confirm(`${name} はすでにあります。上書きしますか。\n\nこの画像を使っている記事の見た目が変わります。`)) {
    return { path, skipped: true };
  }

  const base64 = await readAsBase64(file);
  await api.putBinary(path, base64, already?.sha ?? null, commitMessage(`image ${name}`));
  return { path };
}

function thumbnail(entry, onPick) {
  return h(
    "div",
    { class: "media-item" },
    h(
      "div",
      { class: "media-thumb" },
      h("img", { src: `../${entry.path}`, alt: entry.name, loading: "lazy" }),
    ),
    h("div", { class: "media-name mono", title: entry.name }, entry.name),
    h("div", { class: "media-size mono" }, formatSize(entry.size)),
    h(
      "div",
      { class: "media-actions" },
      h(
        "button",
        {
          class: "button ghost small",
          onclick: () => {
            navigator.clipboard?.writeText(entry.path);
          },
        },
        "パスをコピー",
      ),
      onPick ? h("button", { class: "button small", onclick: () => onPick(entry.path) }, "選ぶ") : null,
    ),
  );
}

/**
 * 画像一覧を描く共通部分。タブでもモーダルでも使う。
 * @param {(path: string) => void} [onPick]  選択できるようにする場合
 */
async function renderGallery(container, api, onPick) {
  const gridEl = h("div", { class: "media-grid" });
  const noticeEl = h("div", { class: "notice", hidden: true });
  const fileInput = h("input", {
    type: "file",
    accept: "image/*",
    multiple: true,
    class: "file-input",
    onchange: (event) => handleFiles([...event.target.files]),
  });

  let entries = [];

  function notify(message, kind) {
    noticeEl.hidden = false;
    noticeEl.className = `notice ${kind}`;
    noticeEl.textContent = message;
    if (kind === "ok") setTimeout(() => (noticeEl.hidden = true), 8000);
  }

  async function refresh() {
    entries = await listImages(api);
    replace(gridEl, ...entries.map((entry) => thumbnail(entry, onPick)));
    if (entries.length === 0) {
      replace(gridEl, h("p", { class: "placeholder" }, "画像がまだありません"));
    }
  }

  async function handleFiles(files) {
    if (files.length === 0) return;
    fileInput.disabled = true;
    const added = [];
    try {
      for (const file of files) {
        const result = await upload(api, file, entries);
        if (!result.skipped) added.push(result.path);
      }
      await refresh();
      notify(
        added.length > 0
          ? `${added.join("、")} を追加しました。1〜2分で公開サイトに反映されます。`
          : "追加された画像はありません。",
        "ok",
      );
    } catch (error) {
      notify(error.message, "error");
    } finally {
      fileInput.disabled = false;
      fileInput.value = "";
    }
  }

  replace(
    container,
    h(
      "div",
      { class: "media-panel" },
      h(
        "div",
        { class: "media-head" },
        h("label", { class: "button small" }, "画像を追加", fileInput),
        h(
          "span",
          { class: "field-hint" },
          `${formatSize(MAX_BYTES)} まで。ファイル名は英数字に整えられます。`,
        ),
      ),
      noticeEl,
      gridEl,
    ),
  );

  await refresh();
}

/** 「画像」タブ。 */
export async function initMedia(container, api) {
  await renderGallery(container, api, null);
}

/**
 * 記事編集から呼ぶ画像選択。
 * @returns {Promise<string|null>} 選ばれたパス、または null
 */
export function pickImage(api) {
  return new Promise((resolve) => {
    const body = h("div", { class: "modal-body" });

    const close = (value) => {
      overlay.remove();
      resolve(value);
    };

    const overlay = h(
      "div",
      { class: "modal-overlay", onclick: (event) => event.target === overlay && close(null) },
      h(
        "div",
        { class: "modal" },
        h(
          "div",
          { class: "modal-head" },
          h("span", { class: "column-title" }, "画像を選ぶ"),
          h("button", { class: "button ghost small", onclick: () => close(null) }, "閉じる"),
        ),
        body,
      ),
    );

    document.body.append(overlay);
    renderGallery(body, api, (path) => close(path)).catch((error) => {
      body.textContent = `画像一覧を読み込めませんでした: ${error.message}`;
    });
  });
}
