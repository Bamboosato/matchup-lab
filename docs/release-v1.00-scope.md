> **旧構成資料**：本書は基準コミット時点の認証・Firebase・外部API構成を記録した履歴資料です。現在のMatchupLabの完了条件は [requirements.md](./requirements.md) を参照してください。

# tennis-organizing-app ver1.00 リリース対象棚卸し

作成日: 2026-05-14

## 1. 目的

本書は、ver1.00 として本番環境（Vercel）へ展開する対象を、現状ローカルで実装されている機能から抽出して固定する。

この段階では新規機能を追加しない。後続のリリース作業では、本書の対象範囲に対して検証、環境設定、本番デプロイ、リリース証跡整理を実施する。

## 2. 判定方針

- 対象範囲は `D:\work_codex\tennis-organizing-app` のローカル実装済み機能とする。
- リリース表示名は `ver1.00`、npm package version は `1.0.0` とする。
- `tennis-matchup-app` と同様に、Vercel は GitHub 連携、Production Branch は `main`、`main` 反映で本番デプロイする前提とする。
- 対戦表作成ロジックは本アプリでは再実装せず、`tennis-matchup-app` の API をサーバー側 route から呼び出す。
- ブラウザへ `MATCHUP_API_KEY` を出さない。API キーは Vercel の環境変数で管理する。
- Firestore のメンバー情報はログインユーザー単位で分離し、Guest では保存しない。

## 3. ver1.00 対象機能

### 3.1 アプリ基盤

| 機能 | 内容 | 主な実装箇所 |
| --- | --- | --- |
| Next.js App Router 構成 | 単一ページ中心の画面構成、Route Handler による API proxy | `src/app/page.tsx`, `src/app/api/matchups/generate/route.ts` |
| Firebase Client SDK 初期化 | Firebase Auth / Cloud Firestore の client 初期化 | `src/lib/firebase/client.ts` |
| 共通スタイル | PC / スマホ向けのレスポンシブ UI | `src/app/globals.css` |
| PDF 用フォント配置 | 日本語 PDF 出力向けの Noto Sans JP フォント利用 | `public/fonts/NotoSansJP-VF.ttf` |

### 3.2 認証

| 機能 | 内容 | 主な実装箇所 |
| --- | --- | --- |
| メール/パスワードログイン | Firebase Authentication によるログイン | `src/app/page.tsx` |
| 新規 ID 登録 | メールアドレス、パスワード、確認パスワードで ID 登録 | `src/app/page.tsx` |
| 登録後の明示ログイン導線 | ID 登録後に自動ログイン状態を解除し、ログイン画面へ戻す | `src/app/page.tsx` |
| パスワード再設定 | Firebase のパスワード再設定メール送信 | `src/app/page.tsx` |
| Guest ログイン | Firebase 匿名認証でホーム画面へ遷移 | `src/app/page.tsx` |
| ログアウト | Firebase Auth のサインアウトと画面状態初期化 | `src/app/page.tsx` |
| ログイン ID 表示 | メールログイン時はメールアドレス、Guest 時は `Guest` を表示 | `src/app/page.tsx` |

### 3.3 メンバー管理

| 機能 | 内容 | 主な実装箇所 |
| --- | --- | --- |
| メンバー一覧購読 | `users/{uid}/members` を Firestore snapshot で購読 | `src/features/members/memberRepository.ts` |
| メンバー登録 | ニックネーム、氏名、性別、備考を登録 | `src/features/members/memberRepository.ts`, `src/app/page.tsx` |
| メンバー編集 | 登録済みメンバーを同一 ID のまま更新 | `src/features/members/memberRepository.ts`, `src/app/page.tsx` |
| メンバー非表示 | 物理削除ではなく `inactive` 更新により一覧/選択から除外 | `src/features/members/memberRepository.ts`, `src/app/page.tsx` |
| 登録上限 | active メンバー 99 人まで | `src/features/members/memberRepository.ts` |
| ニックネーム必須 | 空のニックネーム登録を拒否 | `src/features/members/memberRepository.ts` |
| 並び順キー生成 | ニックネームからアイウエオ順用の内部キーを生成 | `src/features/members/sortKeyKana.ts` |
| Firestore Security Rules | password provider の本人ユーザーのみ read/create/update 許可、delete 不許可 | `firestore.rules` |

### 3.4 ホーム画面・参加者選択

| 機能 | 内容 | 主な実装箇所 |
| --- | --- | --- |
| 条件入力型ホーム | 対戦モード、開催名、参加者、コート数、実施回数を入力 | `src/app/page.tsx` |
| 対戦モード選択 | `通常` / `同性対決優先` / `混合対決優先` | `src/app/page.tsx` |
| 登録メンバー選択 | active メンバーから参加者を仮選択し、OK で確定 | `src/app/page.tsx` |
| 登録ユーザー向けゲスト人数入力 | 参加メンバー選択内で女性/男性のゲスト人数を仮入力し、OK で確定 | `src/app/page.tsx`, `src/features/guests/buildGuestParticipants.ts` |
| 選択上限 | 登録メンバーとゲスト人数の合計が 30 人超過時は確定不可 | `src/app/page.tsx` |
| SUMMARY 表示 | 条件概要を表示し、ゲストがいる場合のみ2行目にゲスト番号内訳を表示 | `src/app/page.tsx` |
| 全選択 / 選択解除 | 参加者選択プルダウン内で一括操作 | `src/app/page.tsx` |
| 登録順 / アイウエオ順 | メンバー表示順を切替 | `src/app/page.tsx`, `src/features/members/sortKeyKana.ts` |
| 男女別人数集計 | 選択中メンバーまたは Guest 入力から女性/男性数を表示 | `src/app/page.tsx` |
| Guest 参加人数入力 | Guest は女性人数・男性人数を手入力して参加者を生成 | `src/app/page.tsx` |
| Guest 制限 | メンバー登録と登録メンバー選択を利用不可にする | `src/app/page.tsx` |
| 条件バリデーション | 参加者 4-30 人、コート 1-8 面、実施 1-20 回で作成可能 | `src/app/page.tsx`, `src/app/api/matchups/generate/route.ts` |
| 使用コート数自動調整 | 参加人数に対して過剰なコート数は `floor(参加者数 / 4)` へ減算 | `src/app/page.tsx` |
| コート減算確認 | 減算が必要な場合は確認ダイアログで OK / キャンセル | `src/app/page.tsx` |

### 3.5 対戦表作成

| 機能 | 内容 | 主な実装箇所 |
| --- | --- | --- |
| API proxy route | `/api/matchups/generate` から `tennis-matchup-app` の `/api/v1/matchups/generate` を呼び出す | `src/app/api/matchups/generate/route.ts` |
| API キー秘匿 | `MATCHUP_API_KEY` をサーバー側でのみ利用 | `src/app/api/matchups/generate/route.ts` |
| API base URL 切替 | `MATCHUP_API_BASE_URL` 未設定時は `https://tennis-matchup-app.vercel.app` を使用 | `src/app/api/matchups/generate/route.ts` |
| proxy 入力検証 | JSON、対戦モード、参加者数、参加者一覧、コート数、回数、性別を検証 | `src/app/api/matchups/generate/route.ts` |
| 性別優先モード制約 | `同性対決優先` / `混合対決優先` では参加者性別を必須化 | `src/app/api/matchups/generate/route.ts` |
| API エラー表示 | API 設定不備、入力不備、API 到達不可、上流エラーを画面へ返す | `src/app/api/matchups/generate/route.ts`, `src/app/page.tsx` |
| 結果表示 | ラウンド、コート、ペア、休憩者をホーム下部に表示 | `src/app/page.tsx` |

### 3.6 PDF 出力

| 機能 | 内容 | 主な実装箇所 |
| --- | --- | --- |
| PDF 作成ボタン | 生成済み対戦表から PDF を保存 | `src/app/page.tsx`, `src/hooks/useMatchupPdfExport.ts` |
| ログインユーザー/Guest 共通 PDF | ニックネームまたはゲスト番号表示、2 コート横並び、3 コート以上の折返し、休憩カードを含む PDF | `src/features/matchups/pdf/buildPdfDocumentModel.ts`, `src/features/matchups/pdf/exportMatchupPdf.ts` |
| 日本語フォント埋め込み | Noto Sans JP を PDF に登録 | `src/features/matchups/pdf/exportMatchupPdf.ts` |
| ページ分割 | PDF 1 ページあたりの行数/ラウンド数を制御 | `src/features/matchups/pdf/buildPdfDocumentModel.ts`, `src/features/matchups/pdf/exportMatchupPdf.ts` |
| ファイル名生成 | 開催名、参加人数、コート数、対戦モードをファイル名に含める | `src/features/matchups/pdf/buildPdfDocumentModel.ts` |
| PDF エラー表示 | PDF 生成失敗時に画面へエラー表示 | `src/hooks/useMatchupPdfExport.ts` |

## 4. ver1.00 対象外・未実装扱い

以下は現状ローカルで実装済みと判断しない。

| 項目 | 理由 |
| --- | --- |
| `tennis-organizing-app` 独自の対戦ロジック | `tennis-matchup-app` API 利用方針のため対象外 |
| `tennis-organizing-app` 側の管理画面 | 現状ソース上に管理画面実装なし |
| `tennis-organizing-app` 側の API キー発行/管理 | `MATCHUP_API_KEY` は `tennis-matchup-app` 側で管理し、ローカル/本番共通キーを利用する |
| `tennis-organizing-app` 側の Firebase Admin SDK 利用 | 現状ソース上では client SDK と API proxy が中心 |
| 自動テスト一式 | `package.json` には `test` script が未定義。ver1.00 では手動スモークと既存コマンドをリリースゲートにする |
| PWA / インストール導線 | 現状の README とソースから ver1.00 対象として固定しない |
| 印刷プレビュー画面 | PDF 出力は対象だが、専用 `/print` 画面は現状対象外 |
| メンバー復元 | inactive から active へ戻す UI は現状対象外 |

## 5. 本番環境依存

### 5.1 tennis-organizing-app 側 Vercel Production 環境変数

| 変数 | 用途 | 担当 |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web SDK | Vercel/Firebase 管理者 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth | Vercel/Firebase 管理者 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project | Vercel/Firebase 管理者 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app | Vercel/Firebase 管理者 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase config | Vercel/Firebase 管理者 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase config | Vercel/Firebase 管理者 |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase config | Vercel/Firebase 管理者 |
| `MATCHUP_API_BASE_URL` | `tennis-matchup-app` API の base URL | Vercel 管理者 |
| `MATCHUP_API_KEY` | ローカルと本番で共通の `tennis-matchup-app` API キー | `tennis-matchup-app` 管理者 / Vercel 管理者 |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Protected Preview 呼び出しが必要な場合のみ | Vercel 管理者 |

### 5.2 tennis-matchup-app 側で維持・確認する環境

`tennis-matchup-app` では管理画面ログイン、API キー管理、API 認証に以下の環境変数と運用設定を使う。

| 項目 | 用途 | 担当 |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` | Admin SDK / Firestore | `tennis-matchup-app` 管理者 |
| `FIREBASE_CLIENT_EMAIL` | Admin SDK service account | `tennis-matchup-app` 管理者 |
| `FIREBASE_PRIVATE_KEY` | Admin SDK service account | `tennis-matchup-app` 管理者 |
| `ADMIN_PASSWORD_HASH` | 管理画面ログイン | `tennis-matchup-app` 管理者 |
| `ADMIN_SESSION_SECRET` | 管理画面セッション | `tennis-matchup-app` 管理者 |
| API key account | ローカル/本番共通 API キー、scope、rate limit、有効状態 | `tennis-matchup-app` 管理者 |

## 6. ver1.00 テスト観点

テストケースを詳細化する前に、以下の観点を固定する。

### 6.1 機能観点

- 認証: メール/パスワード登録、ログイン、パスワード再設定、ログアウト、Guest ログイン。
- メンバー管理: 登録、編集、非表示、一覧表示、99 人上限、アイウエオ順。
- 参加者選択: メンバー選択、登録ユーザー向けゲスト人数入力、Guest 人数入力、男女別人数集計、30 人上限。
- 対戦表作成: 対戦モード、コート数減算確認、API proxy、結果表示。
- PDF: ログインユーザー/Guest 共通 PDF、日本語表示、ファイル名。

### 6.2 非機能観点

- Vercel Production Build が成功すること。
- Firestore Security Rules によりユーザー分離が成立すること。
- `MATCHUP_API_KEY` がブラウザへ露出しないこと。
- API 401/422/500/到達不可時に原因切り分け可能なエラーになること。
- PC / スマホで主要操作が破綻しないこと。
- PDF が A4 縦で読み取れること。

### 6.3 データ観点

- メンバー数: 0、1、98、99、100。
- 参加者数: 0、3、4、30、31。
- コート数: 1、2、3、8、9、参加人数に対して過剰な値。
- 実施回数: 1、4、20、21。
- 性別: female、male、性別優先モードで未指定。
- ニックネーム: 空、同名、長い文字列、かな変換対象。

### 6.4 UI 観点

- エラー表示が入力欄または操作箇所の近くで確認できること。
- disabled 状態の理由が title または表示文言で理解できること。
- メンバー選択プルダウンがスマホ幅で入力欄を不自然に崩さないこと。
- PDF 作成ボタンが生成結果エリアから自然に操作できること。
- 長い名称や休憩者多数でも画面/PDFが読めること。

### 6.5 正常系

| ID | 観点 | ケース | 意図 |
| --- | --- | --- | --- |
| N-001 | 認証 | メール/パスワードで新規 ID 登録後、ログイン画面へ戻り、明示ログインできる | 登録後の状態遷移と通常ログインが成立すること |
| N-002 | 認証 | 登録済みメール/パスワードでログインし、ログイン ID が表示される | 通常利用者の開始状態を保証すること |
| N-003 | Guest | Guest ログイン後、女性/男性人数を入力して対戦表を作成できる | Guest 許可機能が成立すること |
| N-004 | メンバー | メンバーを登録し、一覧と参加者選択へ表示される | Firestore 保存と購読が成立すること |
| N-005 | メンバー | 登録済みメンバーを編集できる | 後編集が同一 ID で成立すること |
| N-006 | メンバー | メンバーを非表示にすると一覧と参加者選択から消える | inactive 運用が成立すること |
| N-007 | 選択 | active メンバーから 4-30 人を選択して確定できる | API 上限内の参加者選択が成立すること |
| N-008 | 並び順 | 登録順とアイウエオ順を切り替えられる | 選択リストの操作性を保証すること |
| N-009 | 対戦表 | 通常、同性対決優先、混合対決優先で生成できる | 対戦モードが API へ反映されること |
| N-010 | コート | 過剰なコート数で確認ダイアログを OK すると減算後の面数で生成される | 使用可能コート数への補正が成立すること |
| N-011 | PDF | ログインユーザーで PDF を作成できる | ニックネーム表示 PDF が成立すること |
| N-012 | PDF | Guest で PDF を作成できる | 通常ログイン時と同じPDFフォーマットが成立すること |

### 6.6 異常系

| ID | 観点 | ケース | 意図 |
| --- | --- | --- | --- |
| E-001 | 認証 | 誤ったパスワードでログインする | 認証エラーが適切に表示されること |
| E-002 | 認証 | 未登録/不正メールでパスワード再設定を試す | Firebase エラーを画面で切り分けられること |
| E-003 | Guest | Guest でメンバー登録を押す | Guest 制限が破れないこと |
| E-004 | メンバー | ニックネーム空で登録する | 必須入力を検出すること |
| E-005 | メンバー | 100 人目を登録する | 登録上限を検出すること |
| E-006 | 選択 | 31 人を選択して OK を押す | API 呼び出し前に上限超過を止めること |
| E-007 | 対戦表 | 参加者 3 人で作成しようとする | 作成不可条件がボタン状態/エラーで分かること |
| E-008 | API | `MATCHUP_API_KEY` 未設定で生成する | サーバー設定不備として切り分けられること |
| E-009 | API | `tennis-matchup-app` API が 401/422 を返す | 上流エラーを画面で確認できること |
| E-010 | API | `tennis-matchup-app` API に到達できない | 到達不可として再試行判断できること |
| E-011 | PDF | PDF フォント取得または保存に失敗する | PDF 失敗が画面に残ること |

### 6.7 境界値

| ID | 観点 | 値 | 意図 |
| --- | --- | --- | --- |
| B-001 | 参加者数 | 3 人 | 作成不可の下限直下 |
| B-002 | 参加者数 | 4 人 | 作成可能の下限 |
| B-003 | 参加者数 | 30 人 | 作成可能の上限 |
| B-004 | 参加者数 | 31 人 | 作成不可の上限超過 |
| B-005 | メンバー数 | 99 人 | 登録可能の上限 |
| B-006 | メンバー数 | 100 人 | 登録不可の上限超過 |
| B-007 | コート数 | 1 / 8 / 9 | API 制約と上限超過 |
| B-008 | コート数 | 参加者 5 人で 2 面 | 使用可能面数 1 への減算 |
| B-009 | 実施回数 | 1 / 20 / 21 | API 制約と上限超過 |
| B-010 | ニックネーム | 空 / 長い文字列 / 同名 | 入力制約と表示崩れ |

### 6.8 状態遷移

| ID | 状態遷移 | 意図 |
| --- | --- | --- |
| S-001 | 未ログイン -> 新規登録 -> ログイン画面 -> ログイン -> ホーム | 新規ユーザー導線が成立すること |
| S-002 | 未ログイン -> ログイン -> ホーム -> ログアウト -> ログイン画面 | セッション終了と画面初期化が成立すること |
| S-003 | 未ログイン -> Guest -> ホーム | Guest 導線が成立し、メンバー機能が制限されること |
| S-004 | ホーム -> メンバー登録 -> ホーム | 通常ユーザーの画面遷移が成立すること |
| S-005 | active -> inactive | 非表示後に一覧/選択から除外されること |
| S-006 | メンバー選択仮変更 -> キャンセル | 仮選択が破棄されること |
| S-007 | メンバー選択仮変更 -> OK -> 生成 | 確定選択が生成条件へ反映されること |
| S-008 | コート減算確認 -> キャンセル | 生成せず入力状態を維持すること |
| S-009 | コート減算確認 -> OK -> 生成結果 -> PDF | 補正後の結果と PDF が一致すること |
| S-010 | API 失敗 -> 条件修正 -> 再生成 | 失敗後も状態が壊れず再実行できること |

## 7. 担当

| 領域 | 主担当 | 補足 |
| --- | --- | --- |
| ver1.00 対象範囲固定 | Codex / 開発担当 | 本書を作成し、ユーザー確認で固定 |
| 最終リリース判断 | ユーザー | v1.00 対象/対象外の承認 |
| 実装修正が必要な場合 | Codex / 開発担当 | No.2 以降で対応 |
| Firebase Auth / Firestore 設定 | Firebase 管理者 | 本番 Firebase project、Auth provider、Rules 反映 |
| Vercel Project / 環境変数 | Vercel 管理者 | Production 環境変数、GitHub 連携 |
| `tennis-matchup-app` API キー | `tennis-matchup-app` 管理者 | ローカル/本番共通キーの値、scope、rate limit、有効状態を確認 |
| 検証 | QA / Codex / ユーザー | 手動スモーク、コマンド実行、証跡整理 |

## 8. No.2 へ進む前の確認事項

- 本書の ver1.00 対象外に、今回公開したい機能が含まれていないこと。
- `tennis-matchup-app` 側のローカル/本番共通 API キーを Vercel Production の `MATCHUP_API_KEY` へ設定できること。
- Firebase 本番 project で Email/Password 認証と Anonymous 認証を有効化できること。
- Firestore Rules を本番反映できる権限があること。
- Vercel Project を GitHub repo `Bamboosato/tennis-organizing-app` から Import できること。
- 現状は `test` script がないため、ver1.00 の自動検証ゲートは `lint` / `typecheck` / `build` / `audit` とし、不足分は手動スモークで補うこと。

## 9. No.10 ローカル品質ゲート結果

実施日: 2026-05-14

| コマンド | 結果 | 補足 |
| --- | --- | --- |
| `npm run lint` | Pass | ESLint 成功 |
| `npx --no-install tsc --noEmit` | Pass | TypeScript 明示チェック成功 |
| `npm run build` | Pass | Next.js 16.2.6 / Turbopack production build 成功 |
| `npm audit` | Pass | `found 0 vulnerabilities` |

`package.json` には `test` script が未定義のため、ver1.00 の自動品質ゲートは上記4件とする。画面操作、認証、Firestore、対戦表API、PDF出力は本番デプロイ後の手動スモークで確認する。
