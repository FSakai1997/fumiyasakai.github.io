/**
 * JSONファイルの読み書き。ニュースとCVで共有する。
 *
 * 事故を防ぐための決まりが3つある。
 *   1. 読み込み時の sha を保持し、保存時に必ず添える。GitHub側が別経路で
 *      更新されていれば保存は失敗する。黙って上書きすることはない。
 *   2. 保存前に件数の変化を示す。減る操作は意図しない削除の可能性が高い。
 *   3. 未保存の変更があるまま画面を離れようとしたら警告する。
 */

import { ConflictError } from "./github-api.js";

/** 未保存の変更を持つストア。ページ離脱の警告に使う。 */
const dirtyStores = new Set();

// ブラウザ以外（テスト）から読み込まれることがあるので、存在を確かめてから触る。
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (event) => {
    if (dirtyStores.size === 0) return;
    event.preventDefault();
    // 文面はブラウザが決める。イベントを止めること自体が警告の合図になる。
    event.returnValue = "";
  });
}

/** テスト用。未保存のストアが何件あるか。 */
export function dirtyCount() {
  return dirtyStores.size;
}

export class JsonStore {
  /**
   * @param {import("./github-api.js").GitHubApi} api
   * @param {string} path  リポジトリ内のパス（例 "data/news.json"）
   * @param {(data: any) => number} countOf  件数の数え方
   */
  constructor(api, path, countOf) {
    this.api = api;
    this.path = path;
    this.countOf = countOf;
    this.data = null;
    this.sha = null;
    this.savedCount = 0;
    this.dirty = false;
  }

  async load() {
    const file = await this.api.getFile(this.path);
    if (file.text === null) throw new Error(`${this.path} が見つかりません。`);
    this.data = JSON.parse(file.text);
    this.sha = file.sha;
    this.savedCount = this.countOf(this.data);
    this.setDirty(false);
    return this.data;
  }

  setDirty(value) {
    this.dirty = value;
    if (value) dirtyStores.add(this);
    else dirtyStores.delete(this);
    this.onDirtyChange?.(value);
  }

  /** 保存したときに件数がどう変わるか。 */
  countChange() {
    const before = this.savedCount;
    const after = this.countOf(this.data);
    return { before, after, delta: after - before };
  }

  serialize() {
    return JSON.stringify(this.data, null, 2) + "\n";
  }

  /**
   * GitHubへ保存する。
   * 競合していれば ConflictError を投げる。呼び出し側で握りつぶさないこと。
   */
  async save(message) {
    const result = await this.api.putFile(this.path, this.serialize(), this.sha, message);
    this.sha = result.sha;
    this.savedCount = this.countOf(this.data);
    this.setDirty(false);
    return result;
  }

  /** 競合後に、GitHub側の最新内容を取り直す。手元の変更は捨てられる。 */
  async reload() {
    this.setDirty(false);
    return this.load();
  }
}

export { ConflictError };

/** コミットメッセージ。いつ何を更新したかが履歴から読めるようにする。 */
export function commitMessage(what) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `content: update ${what} (${stamp})`;
}
