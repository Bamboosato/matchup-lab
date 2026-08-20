> **旧構成資料**：本書は基準コミット時点のFirebase/APIを含むPWA設計を記録した履歴資料です。現行仕様は [requirements.md](./requirements.md) と [design.md](./design.md) を参照してください。

# PWA Service Worker 静的アセットキャッシュ設計

## 1. 目的

ホーム画面追加後の再訪問や通信状態が不安定な場面で、アイコン、フォント、Next.js のビルド済み静的アセットを Service Worker 経由で再利用しやすくする。

本対応は静的アセットの体感改善に限定し、画面 HTML、対戦表生成 API、Firebase Authentication、Firestore データ、対戦結果データはキャッシュしない。

## 2. 対象範囲

対象:

- `src/app/manifest.ts` による Web App Manifest の追加
- `public/sw.js` による Service Worker の追加
- production 環境での Service Worker 登録
- `/icons/*`、`/fonts/*`、`/_next/static/*` の runtime cache
- `/icons/icon-192.png`、`/icons/icon-512.png` の install 時 precache
- `/sw.js` の no-store ヘッダー設定
- Playwright による manifest / Service Worker / Cache Storage の E2E 検証

対象外:

- HTML のオフラインキャッシュ
- API レスポンスのキャッシュ
- Firebase Authentication / Firestore データのキャッシュ
- Push 通知
- Background Sync
- IndexedDB へのデータ保存

## 3. キャッシュ方針

| 対象 | 方針 | 理由 |
| --- | --- | --- |
| `/_next/static/*` | stale while revalidate | ファイル名がビルド単位で変わるため古いレスポンスを使っても安全性が高い |
| `/icons/*` | stale while revalidate + 主要アイコン precache | ホーム画面追加と再訪問時に必要になる |
| `/fonts/*` | stale while revalidate | PDF 用フォント再取得の負荷を抑える |
| HTML | キャッシュしない | 古い画面が残る事故を避ける |
| `/api/*` | キャッシュしない | 生成結果、認証状態、外部 API 依存を古くしない |

Service Worker 自体は `/sw.js` として配信し、`Cache-Control: no-cache, no-store, must-revalidate` を付ける。

画面左上のアプリアイコンと metadata の icon URL は `iconv=crop-v1` のような手動バージョンを使う。通常のアプリ更新では変更せず、アイコン画像そのものを差し替える場合だけ更新する。

## 4. キャッシュバージョン

キャッシュ名は `tennis-organizing-static-v1` とする。

この version はアプリ version ではなく、キャッシュ方針の version として扱う。通常のアプリ更新では変更しない。キャッシュ対象、キャッシュ戦略、保存データの扱いを変える場合だけ更新する。

Service Worker の `activate` で `tennis-organizing-static-` から始まる古いキャッシュを削除し、静的アセットキャッシュだけを入れ替える。

## 5. テスト設計

### 5.1 テスト観点

機能観点:

- `/manifest.webmanifest` が配信され、アプリ名、起動 URL、表示モード、主要アイコンを持つこと。
- `/sw.js` が JavaScript として配信されること。
- Service Worker 登録後、対象静的アセットが Cache Storage に保存されること。
- `/api/*` が Cache Storage に保存されないこと。

非機能観点:

- Service Worker 登録失敗時も画面利用を妨げないこと。
- 開発時の HMR や通常テストに影響しないよう、アプリからの自動登録は production に限定すること。
- `/sw.js` がブラウザに強くキャッシュされず、更新を拾えること。

データ観点:

- 参加者、seed、対戦表生成結果、ログイン状態、Firestore データをキャッシュしないこと。
- キャッシュキーはリクエスト URL 単位で扱い、クエリ付き静的アセットも別リソースとして扱えること。

UI 観点:

- Service Worker 追加による画面表示変更はないこと。
- PWA インストール用バナーや追加導線は作らないこと。

### 5.2 正常系

- `/manifest.webmanifest` を取得し、manifest として必要な値を確認する。
- `/sw.js` を取得し、JavaScript として配信されることを確認する。
- Service Worker を登録し、`/icons/icon-192.png` を取得した後、静的キャッシュに保存されることを確認する。

### 5.3 異常系

- Service Worker が利用できないブラウザでも画面表示に影響しない。
- API を取得しても静的キャッシュに保存されない。

### 5.4 境界値

- 同一 origin の GET のみキャッシュ対象にする。
- Range request はキャッシュ対象外にする。
- キャッシュ対象 path の prefix に一致しない URL はキャッシュしない。

### 5.5 状態遷移

| 状態 | 操作 | 期待状態 |
| --- | --- | --- |
| Service Worker 未登録 | production 画面を開く | `/sw.js` が登録される |
| 新 Service Worker install | 主要アイコンを precache | 静的キャッシュが作成される |
| fetch 発生 | 対象静的アセットを取得 | cache hit があれば返し、裏で更新する |
| activate | 古い静的キャッシュあり | 現行キャッシュ以外を削除する |

## 6. リスクと優先度

まず防ぐべき不具合:

- HTML や API をキャッシュして古い画面、古い生成結果、古い認証状態を返す。
- Service Worker ファイル自体が強くキャッシュされ、更新できなくなる。
- 開発時の Service Worker が残り、HMR や E2E の挙動を不安定にする。

優先度:

- 致命: API / 認証 / Firestore データの誤キャッシュ
- 重大: `/sw.js` の強キャッシュによる更新不能
- 軽微: アイコンやフォントの再取得増加

対策:

- fetch handler で対象 path を明示的に限定する。
- `/sw.js` に no-store ヘッダーを設定する。
- 自動登録は production のみにする。
- E2E では登録、静的キャッシュ、API 非キャッシュを明示的に確認する。
