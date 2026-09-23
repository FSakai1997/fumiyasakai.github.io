/**
 * 編集コンソールの起動とタブ制御。
 *
 * 画面は2つだけ。ログイン画面と編集画面。
 * 各タブの中身は、それぞれの専用モジュールが描画する。
 */

import { loadToken, saveToken, clearToken, validate, daysUntilExpiry } from "./auth.js";

/** 残りがこの日数を切ったら、トークンの再発行を促す。 */
const EXPIRY_WARNING_DAYS = 30;

const views = {
  boot: document.getElementById("boot"),
  login: document.getElementById("login-view"),
  editor: document.getElementById("editor-view"),
};

const loginForm = document.getElementById("login-form");
const tokenInput = document.getElementById("token-input");
const rememberInput = document.getElementById("remember-input");
const loginButton = document.getElementById("login-button");
const loginError = document.getElementById("login-error");
const expiryBadge = document.getElementById("expiry-badge");
const expiryWarning = document.getElementById("expiry-warning");

/** タブ名 → そのタブを初期化する関数。読み込みは初回表示まで遅らせる。 */
const PANEL_LOADERS = {
  news: () => import("./news-editor.js").then((m) => m.initNewsEditor),
  research: () => import("./research-editor.js").then((m) => m.initResearchEditor),
  cv: () => import("./cv-editor.js").then((m) => m.initCvEditor),
  media: () => import("./media.js").then((m) => m.initMedia),
};

const initialised = new Set();
let api = null;

function show(name) {
  views.boot.hidden = name !== "boot";
  views.login.hidden = name !== "login";
  views.editor.hidden = name !== "editor";
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.hidden = !message;
}

function renderExpiry(expiry) {
  const days = daysUntilExpiry(expiry);
  if (days === null) {
    expiryBadge.hidden = true;
    expiryWarning.hidden = true;
    return;
  }

  expiryBadge.hidden = false;
  expiryBadge.textContent = `トークン残り ${days}日`;
  expiryBadge.classList.toggle("soon", days < EXPIRY_WARNING_DAYS);

  if (days < EXPIRY_WARNING_DAYS) {
    expiryWarning.hidden = false;
    expiryWarning.textContent =
      days <= 0
        ? "トークンの有効期限が切れています。GitHubで再発行してください。"
        : `トークンの有効期限まで残り ${days}日です。期限が切れる前に再発行してください。`;
  } else {
    expiryWarning.hidden = true;
  }
}

async function openPanel(name) {
  for (const tab of document.querySelectorAll(".tab")) {
    tab.setAttribute("aria-selected", String(tab.dataset.panel === name));
  }
  for (const panel of document.querySelectorAll(".panel")) {
    panel.hidden = panel.id !== `panel-${name}`;
  }

  if (initialised.has(name)) return;
  const container = document.getElementById(`panel-${name}`);
  container.innerHTML = '<p class="placeholder">読み込んでいます…</p>';
  try {
    const init = await PANEL_LOADERS[name]();
    await init(container, api);
    initialised.add(name);
  } catch (error) {
    console.error(error);
    container.innerHTML = `<p class="placeholder">この画面を読み込めませんでした: ${error.message}</p>`;
  }
}

function enterEditor(validated) {
  api = validated.api;
  // デバッグ用。コンソールから getFile / putFile を直接試せる。
  window.api = api;
  renderExpiry(validated.tokenExpiry);
  show("editor");
  openPanel("news");
}

async function attemptLogin(token, remember) {
  loginButton.disabled = true;
  loginButton.textContent = "確認しています…";
  showLoginError("");

  const result = await validate(token);

  loginButton.disabled = false;
  loginButton.textContent = "接続する";

  if (!result.ok) {
    showLoginError(result.reason);
    return false;
  }

  if (remember !== null) saveToken(token.trim(), remember);
  enterEditor(result);
  return true;
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  attemptLogin(tokenInput.value, rememberInput.checked);
});

document.getElementById("logout-button").addEventListener("click", () => {
  clearToken();
  location.reload();
});

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => openPanel(tab.dataset.panel));
}

/** 起動。保存済みトークンがあれば、そのまま編集画面へ入る。 */
(async function start() {
  show("boot");
  const saved = loadToken();
  if (!saved) {
    show("login");
    return;
  }

  const result = await validate(saved);
  if (result.ok) {
    enterEditor(result);
    return;
  }

  // 保存されていたトークンが失効していた。消してログイン画面へ戻す。
  clearToken();
  show("login");
  showLoginError(result.reason);
})();
