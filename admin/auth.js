/**
 * トークンの保存・検証・破棄。
 *
 * 管理ページ自体は誰でも開ける。保存操作ができるのは、このサイトの
 * リポジトリに書き込めるトークンを持つ人だけ。鍵の検証は GitHub が行う。
 *
 * 「このPCに記憶する」が有効なら localStorage、無効なら sessionStorage
 * （タブを閉じると消える）に置く。共用PCでは記憶させないこと。
 */

import { GitHubApi, ApiError, REPO } from "./github-api.js";

const TOKEN_KEY = "gh_token";
const STORE_KEY = "gh_token_store";

function stores() {
  // プライベートブラウジングでは storage へのアクセス自体が例外になりうる。
  try {
    return { local: window.localStorage, session: window.sessionStorage };
  } catch {
    return { local: null, session: null };
  }
}

export function saveToken(token, remember) {
  const { local, session } = stores();
  clearToken();
  const target = remember ? local : session;
  if (!target) return false;
  try {
    target.setItem(TOKEN_KEY, token);
    target.setItem(STORE_KEY, remember ? "local" : "session");
    return true;
  } catch {
    return false;
  }
}

export function loadToken() {
  const { local, session } = stores();
  for (const store of [session, local]) {
    try {
      const token = store?.getItem(TOKEN_KEY);
      if (token) return token;
    } catch {
      // 読めなければ未ログイン扱いにする。
    }
  }
  return null;
}

export function clearToken() {
  const { local, session } = stores();
  for (const store of [local, session]) {
    try {
      store?.removeItem(TOKEN_KEY);
      store?.removeItem(STORE_KEY);
    } catch {
      // 消せなくても続行する。
    }
  }
}

/** トークンの残り日数。期限が分からなければ null。 */
export function daysUntilExpiry(expiry) {
  if (!expiry) return null;
  const at = new Date(expiry);
  if (Number.isNaN(at.getTime())) return null;
  return Math.floor((at.getTime() - Date.now()) / 86400000);
}

/**
 * トークンを検証する。
 * 失敗したときは「次に何をすればよいか」が分かる文面を返す。
 */
export async function validate(token) {
  if (!token || token.trim() === "") {
    return { ok: false, reason: "トークンが入力されていません。" };
  }

  const api = new GitHubApi(token.trim());
  try {
    const repo = await api.getRepo();
    if (!repo.canPush) {
      return {
        ok: false,
        reason:
          "トークンに書き込み権限がありません。GitHubでトークンを編集し、" +
          "Permissions → Repository permissions → Contents を " +
          "「Read and write」にしてください。",
      };
    }
    return { ok: true, api, tokenExpiry: repo.tokenExpiry };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    if (error.status === 0) {
      return { ok: false, reason: error.message };
    }
    if (error.status === 401) {
      return {
        ok: false,
        reason:
          "トークンが無効か、有効期限が切れています。" +
          "GitHubで新しいトークンを発行してください。",
      };
    }
    if (error.status === 403) {
      return {
        ok: false,
        reason:
          "GitHubがこのトークンの利用を拒否しました。" +
          "組織の制限がかかっていないか、権限設定を確認してください。",
      };
    }
    if (error.status === 404) {
      return {
        ok: false,
        reason:
          `このトークンはリポジトリ ${REPO} にアクセスできません。` +
          "トークン発行時の Repository access で、このリポジトリを" +
          "選んだか確認してください。",
      };
    }
    return { ok: false, reason: `GitHubからの応答: ${error.message}` };
  }
}
