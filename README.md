# tennis-organizing-app

テニス練習会向けのメンバー管理と対戦表作成アプリです。

公開URL: [https://tennis-organizing-app.bamboosato.com/](https://tennis-organizing-app.bamboosato.com/)
既存の Vercel URL: [https://tennis-organizing-app.vercel.app/](https://tennis-organizing-app.vercel.app/)

## Current Artifacts

- [要件分析・設計方針](docs/requirements-design.md)
- [ver1.00 リリース対象棚卸し](docs/release-v1.00-scope.md)
- [Firebase 本番設定チェックリスト](docs/firebase-production-setup.md)
- [Vercel 本番設定チェックリスト](docs/vercel-production-setup.md)
- [PWA Service Worker 静的アセットキャッシュ設計](docs/pwa-service-worker-design.md)
- [PDFレイアウトサンプル 2コート](docs/pdf-layout-portrait-2-courts.png)
- [PDFレイアウトサンプル 3コート](docs/pdf-layout-portrait-3-courts.png)

## Setup Notes

開発時は `.env.local.example` を参考に `.env.local` を作成します。
`.env.local` は秘密情報を含むため Git 管理対象外です。

主な外部サービス:

- Firebase Authentication
- Cloud Firestore
- `tennis-matchup-app` API

## Development

```powershell
npm install
npm run dev
```

ローカルURL:

```txt
http://localhost:3000
```

検証:

```powershell
npm run lint
npx --no-install tsc --noEmit
npm test
npm run build
npm run test:e2e
npm audit
```

`npm run test:e2e` は本番ビルド後の `next start` に対して Playwright を実行します。ローカルで単独実行する場合は、先に `npm run build` を実行してください。

## Firebase Rules

メンバー登録はローカル画面からでも Cloud Firestore へ保存します。
Firebase Console または Firebase CLI で `firestore.rules` を `tennis-organizing-app` に反映してください。

Firebase CLI を使う場合:

```powershell
firebase login
firebase use tennis-organizing-app
firebase deploy --only firestore:rules
```

このリポジトリでは `.firebaserc` で default project を `tennis-organizing-app` に固定しています。本番反映前は、`firebase use` または `firebase projects:list` で対象 project を確認してください。

## Deploy

Vercel で公開します。運用は `tennis-matchup-app` と同様に、GitHub 連携による自動デプロイを前提とします。

- GitHub: `main` ブランチ運用
- Vercel: GitHub リポジトリ連携で自動デプロイ
- Production Branch: `main`
- Production Deployment: `main` への merge または push
- `tennis-matchup-app` と同様に、ver1.00 リリース運用では Preview Deployment を使用しない
- リリース表示名: `ver1.00`
- npm package version: `1.0.0`

### 初回デプロイの流れ

1. `codex/release-v1.00` ブランチで ver1.00 対象範囲、version、README を確定する。
2. Firebase 本番 project で Email/Password 認証と Anonymous 認証を有効化する。
3. Cloud Firestore を有効化し、`firestore.rules` を本番 project へ反映する。
4. `tennis-matchup-app` のローカル/本番共通 API キーを確認し、scope、rate limit、有効状態を確認する。
5. Vercel で GitHub リポジトリ `Bamboosato/tennis-organizing-app` を Import する。
6. Framework Preset は `Next.js` のまま Deploy 設定する。
7. Vercel Project の Production Environment Variables を設定する。
8. Pull Request を `main` に merge し、Production Deployment を作成する。
9. 本番 URL でスモーク確認を実施する。
10. 本番確認後に release tag `v1.00` を作成する。

### Vercel Environment Variables

`tennis-organizing-app` の Vercel Project には、Production 用に以下を設定します。ver1.00 では Preview Deployment を使用しないため、Preview 用の API 環境変数は必須にしません。

| 変数 | 用途 | 備考 |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web SDK | Firebase Console の Web app 設定値 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Authentication | Firebase Console の Web app 設定値 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project | Firestore Rules の project と一致させる |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web app | Firebase Console の Web app 設定値 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase config | Firebase Console の Web app 設定値 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase config | Firebase Console の Web app 設定値 |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase config | 未使用でも Firebase config として合わせる |
| `MATCHUP_API_BASE_URL` | `tennis-matchup-app` API base URL | 通常は `https://tennis-matchup-app.vercel.app` |
| `MATCHUP_API_KEY` | 対戦表 API 認証 | ローカルと本番で共通の `tennis-matchup-app` API キー |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Protected Preview 呼び出し | 必要な場合のみ |

`MATCHUP_API_KEY` はサーバー側 route だけで使用し、ブラウザへ公開しません。

`tennis-matchup-app` 側では、管理画面ログイン、API キー管理、API 認証のために `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`、`ADMIN_PASSWORD_HASH`、`ADMIN_SESSION_SECRET` を維持します。`tennis-organizing-app` は、ローカルと本番で共通の API キーを `MATCHUP_API_KEY` として利用します。キーを分けるのは、漏えい対応やrate limit分離などで明示的にローテーションする場合だけです。

### リリース前確認

```powershell
npm run lint
npx --no-install tsc --noEmit
npm test
npm run build
npm run test:e2e
npm audit
```

主な手動スモーク:

- メール/パスワードで新規登録後、ログイン画面へ戻り、明示ログインできる
- Guest ログイン後、人数手入力で対戦表を作成できる
- メンバー登録、編集、非表示ができる
- 登録メンバーから 4-30 人を選択し、通常 / 同性対決優先 / 混合対決優先で対戦表を作成できる
- 過剰なコート数で確認ダイアログが表示され、OK で使用可能面数に減算される
- ログインユーザーと Guest の両方で PDF を作成できる

## Versioning

- アプリ version は `package.json` で管理します。
- ver1.00 の package version は `1.0.0` です。
- ver1.00 の release branch は `codex/release-v1.00` です。
- 本番確認後の release tag は `v1.00` とします。
- 開発ブランチ名と package version は別で扱います。

## Implemented Scope

- Next.js App Router の初期構成
- Firebase Client SDK 初期化
- メール/パスワード認証
- 新規ID登録後にログイン画面へ戻るパスワード設定フロー
- Guestログイン
- `tennis-matchup-app` に近い条件入力型ホーム画面
- ホーム画面からのメンバー登録画面遷移
- Firestore `users/{uid}/members/{memberId}` へのメンバー登録、編集、非表示
- 登録順 / アイウエオ順の表示切替
