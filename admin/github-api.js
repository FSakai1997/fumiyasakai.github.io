/**
 * GitHub Contents API の薄いラッパ。
 *
 * このサイトは GitHub Pages で配信されており、サーバー側の処理を持てない。
 * 管理画面は利用者の Fine-grained Personal Access Token を使って
 * ブラウザから直接 GitHub にコミットする。認証の検証は GitHub が行う。
 */

export const OWNER = "FSakai1997";
export const REPO = "fumiyasakai.github.io";
export const BRANCH = "main";

const API = "https://api.github.com";

/** 別の場所からファイルが更新されていた場合に投げる。上書きは決してしない。 */
export class ConflictError extends Error {
  constructor(path) {
    super(
      `${path} は別の場所から更新されています。` +
        `上書きを避けるため保存を中止しました。再読み込みしてください。`,
    );
    this.name = "ConflictError";
    this.path = path;
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * UTF-8 文字列を base64 にする。
 * 日本語を含むため、素の btoa() は使えない（Latin-1 しか扱えず例外になる）。
 */
export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** base64 を UTF-8 文字列に戻す。 */
export function decodeBase64(base64) {
  const binary = atob(String(base64).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GitHubApi {
  constructor(token) {
    this.token = token;
    /** 直近のレスポンスから読み取ったトークンの有効期限。 */
    this.tokenExpiry = null;
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${API}${path}`, {
        ...options,
        cache: "no-store",
        headers: { ...this.headers, ...(options.headers ?? {}) },
      });
    } catch (cause) {
      throw new ApiError(0, "GitHubに接続できませんでした。通信環境を確認してください。");
    }

    const expiry = response.headers.get("github-authentication-token-expiration");
    if (expiry) this.tokenExpiry = expiry;

    return response;
  }

  async json(path, options) {
    const response = await this.request(path, options);
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new ApiError(response.status, detail.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /** リポジトリ情報。トークンの有効性と書き込み権限の確認に使う。 */
  async getRepo() {
    const repo = await this.json(`/repos/${OWNER}/${REPO}`);
    return {
      canPush: repo.permissions?.push === true,
      tokenExpiry: this.tokenExpiry,
      defaultBranch: repo.default_branch,
    };
  }

  /**
   * ファイルを読む。存在しなければ { text: null, sha: null } を返す
   * （新規作成に対応するため、404 は失敗としない）。
   */
  async getFile(path) {
    const response = await this.request(
      `/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`,
    );
    if (response.status === 404) return { text: null, sha: null };
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new ApiError(response.status, detail.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return { text: decodeBase64(data.content), sha: data.sha };
  }

  /** ディレクトリの中身を一覧する。存在しなければ空配列。 */
  async listDir(path) {
    const response = await this.request(
      `/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}`,
    );
    if (response.status === 404) return [];
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new ApiError(response.status, detail.message || `HTTP ${response.status}`);
    }
    const entries = await response.json();
    return Array.isArray(entries) ? entries : [];
  }

  /** base64 の中身をそのまま書き込む。テキストと画像の共通処理。 */
  async putBase64(path, base64, sha, message) {
    const body = { message, content: base64, branch: BRANCH };
    if (sha) body.sha = sha;

    const response = await this.request(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // 409 も 422 も「手元の sha が古い」ことを意味する。上書きせず中止する。
    if (response.status === 409 || response.status === 422) throw new ConflictError(path);

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new ApiError(response.status, detail.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { sha: data.content.sha, commitUrl: data.commit.html_url };
  }

  /** テキストファイルを書き込む。 */
  putFile(path, text, sha, message) {
    return this.putBase64(path, encodeBase64(text), sha, message);
  }

  /** 画像などのバイナリを書き込む。base64 は data URL の「,」以降の部分。 */
  putBinary(path, base64, sha, message) {
    return this.putBase64(path, base64, sha, message);
  }
}

/** 画面に出す用のURL。 */
export function repoUrl(path = "") {
  return `https://github.com/${OWNER}/${REPO}${path}`;
}
