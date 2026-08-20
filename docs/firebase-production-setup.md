> **旧構成資料**：本書は基準コミット時点のFirebase構成を記録した履歴資料です。現在のMatchupLabではFirebaseを利用しません。現行仕様は [requirements.md](./requirements.md) と [design.md](./design.md) を参照してください。

# tennis-organizing-app Firebase 本番設定チェックリスト

作成日: 2026-05-14

## 1. 目的

ver1.00 本番展開に必要な Firebase 側設定を固定する。

この作業は Firebase Console と Firebase CLI の両方にまたがる。Auth provider の有効化と Cloud Firestore の作成は Firebase Console 側で確認し、Firestore Security Rules の反映は No.6 で CLI または Console から実施する。

## 2. 対象 project

| 項目 | 値 |
| --- | --- |
| Firebase project ID | `tennis-organizing-app` |
| Firebase project display name | `tennis-organizing-app` |
| Firebase CLI project | `.firebaserc` の `default` で `tennis-organizing-app` に固定 |
| Firestore Rules file | `firestore.rules` |
| Firebase config file | `firebase.json` |

ローカル確認結果:

- Firebase CLI は利用可能。
- Firebase CLI はログイン済み。
- `firebase projects:list` で `tennis-organizing-app` が current project として表示される。
- `firebase apps:list WEB --project tennis-organizing-app` で Web app `tennis-organizing-app` を確認済み。
- `firebase firestore:databases:list --project tennis-organizing-app` で default database を確認済み。
- これまで `.firebaserc` が無かったため、誤 deploy 防止として `default` project を本リポジトリに固定した。

## 3. Firebase Authentication

Firebase Console で以下を確認する。

| 項目 | 必須 | 確認内容 |
| --- | --- | --- |
| Authentication | 必須 | Firebase Console で Authentication を開始済み |
| Email/Password provider | 必須 | Sign-in method で Email/Password を有効化 |
| Anonymous provider | 必須 | Sign-in method で Anonymous を有効化 |
| Authorized domains | 必須 | 本番利用する公開ドメインと Preview 確認に必要なドメインを許可 |
| Password policy | 任意 | ver1.00 では Firebase 既定または運用方針に合わせる |

2026-05-22 時点で、主公開URL用の `tennis-organizing-app.bamboosato.com` を Firebase Authentication の Authorized domains に追加済み。Firebase default domains は継続利用する。

アプリ側の利用箇所:

| 機能 | Firebase Auth API | 実装箇所 |
| --- | --- | --- |
| 新規 ID 登録 | `createUserWithEmailAndPassword` | `src/app/page.tsx` |
| メールログイン | `signInWithEmailAndPassword` | `src/app/page.tsx` |
| Guest ログイン | `signInAnonymously` | `src/app/page.tsx` |
| パスワード再設定 | `sendPasswordResetEmail` | `src/app/page.tsx` |
| ログアウト | `signOut` | `src/app/page.tsx` |

## 4. Cloud Firestore

Firebase Console で以下を確認する。

| 項目 | 必須 | 確認内容 |
| --- | --- | --- |
| Cloud Firestore database | 必須 | `tennis-organizing-app` project で作成済み |
| Database location | 必須 | 作成済みの場合は変更不可。未作成の場合は本番運用方針に合わせて決定 |
| Security Rules | 必須 | No.6 で `firestore.rules` を反映 |
| Indexes | 現状不要 | ver1.00 の `members` query は `displayOrder` 単一 `orderBy` のみ |

データ構造:

```text
users/{uid}
  members/{memberId}
```

ver1.00 の Security Rules 方針:

- Firebase Auth の signed-in user のみ対象。
- `request.auth.uid` と path の `{userId}` が一致する user のみ許可。
- `request.auth.token.firebase.sign_in_provider == "password"` のユーザーだけが `users/{uid}` と `users/{uid}/members/{memberId}` を read/create/update できる。
- Guest / Anonymous user はメンバー管理データへアクセスできない。
- delete は許可しない。画面上の削除は `inactive` への update とする。

## 5. Web App config

Firebase Console の Web app 設定から、以下を Vercel Production Environment Variables へ転記する。

| Vercel 変数 | Firebase config |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `measurementId` |

CLIで確認済みの Web app:

| 項目 | 値 |
| --- | --- |
| App display name | `tennis-organizing-app` |
| App ID | `1:7958351367:web:c072f5cad9c7db9d21a4a2` |
| Platform | `WEB` |

Preview Deployment で本番相当の確認を行う場合は、Preview Environment Variables にも同じ project または検証用 project の値を設定する。

## 6. No.6 へ進む前の確認事項

- Firebase Console で `tennis-organizing-app` project を開けること。
- Authentication の Email/Password と Anonymous が有効であること。
- Vercel 本番ドメイン、または想定本番ドメインを Authorized domains に追加できること。
- Cloud Firestore database が作成済みであること。
- No.6 で `firebase deploy --only firestore:rules --project tennis-organizing-app` を実行してよい状態であること。
- Rules deploy 前に、Firebase Console 側の既存 Rules を上書きして問題ないこと。

## 7. No.5 完了判定

No.5 は以下を満たしたら完了とする。

- Firebase project `tennis-organizing-app` の存在を確認済み。
- Firebase Web app と Cloud Firestore default database の存在を確認済み。
- リポジトリに `.firebaserc` を追加し、default project を固定済み。
- Auth provider / Firestore / Web App config / Vercel転記項目の確認リストを本書に整理済み。

Firestore Rules の本番反映は No.6 の作業として扱う。

## 8. No.6 Firestore Rules 本番反映結果

実施日: 2026-05-14

実行コマンド:

```powershell
firebase deploy --only firestore:rules --project tennis-organizing-app
```

結果:

- Deploy target: `tennis-organizing-app`
- Rules file: `firestore.rules`
- Compilation: success
- Upload: latest version already up to date
- Release: `firestore.rules` released to `cloud.firestore`
- Final status: Deploy complete
