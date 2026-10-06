# MatchupLab

メンバー管理とシングルス・ダブルスの対戦表作成を、ブラウザ内で行うローカルファースト型アプリです。ログインは不要で、メンバーはこの端末のブラウザに保存し、組合せはブラウザ内で生成します。Firebase・クラウド保存・外部組合せAPIは使用しません。

## 実装済みの機能

| 機能 | 内容 |
| --- | --- |
| メンバー管理 | 登録・編集・確認後の完全削除。有効メンバー最大99人。登録順／アイウエオ順の表示切替 |
| 参加者選択 | 登録メンバーの個別選択・全選択・全解除、女性／男性の当日ゲスト入力。合計最大30人 |
| ダブルス | 4〜30人。通常／同性対決優先／混合対決優先 |
| シングルス | 2〜30人。対戦モードは通常固定 |
| 条件入力 | 開催名、コート1〜8面、実施回数1〜20回。人数に対してコートが過剰な場合は減算確認 |
| 結果表示 | ラウンド別のコート・対戦者・休憩者。作成ボタンの再押下で新しいseedから生成 |
| PDF | 表示中の結果をA4縦PDFへ出力。日本語フォント、休憩者、ページ番号に対応 |
| JSONバックアップ | 全メンバーの書き出し、スキーマ・型・重複ID・有効人数の検証、確認後の全置換復元 |
| PWA | MatchupLabのmanifest・アイコン、アプリシェルと静的資産のキャッシュ、オフライン表示、利用者操作による更新 |
| レスポンシブUI | デスクトップのナビゲーションとモバイルメニュー。狭幅ではメンバー操作をアイコン表示 |

「同性対決優先」「混合対決優先」は組合せ評価の優先条件であり、全試合での成立を保証する指定ではありません。

## 利用の流れと保存範囲

1. `/members` でメンバーを登録します。登録せず、当日ゲストだけでも対戦表を作成できます。
2. `/matchups/doubles` または `/matchups/singles` で「メンバー選択」を開き、参加者・ゲスト人数を指定してOKで確定します。キャンセルは仮入力を破棄します。
3. 開催名・コート数・実施回数を指定して「対戦表作成」を押します。結果の「PDF作成」から書き出せます。
4. メンバー画面の「バックアップ」でJSONを保存し、「復元」で読み込みます。復元は追加・マージではなく全置換です。空のバックアップは0件への置換になります。

メンバーだけをIndexedDBに永続化します。条件・参加者選択・結果はシングルスとダブルスごとにメモリー内で保持し、画面を移動しても残ります。再読み込みやPWA更新では初期化されます。

保存先は同じオリジン・ブラウザプロファイルに限定されます。別端末・別ブラウザとの自動同期はなく、サイトデータ削除などで失われる場合があります。削除したメンバーを戻すUIはありません。必要なデータは削除前にJSONへバックアップしてください。JSONには氏名・性別・備考などが含まれ、暗号化されません。

オフライン利用には、初回オンラインアクセス、本番モードでのService Worker登録、必要な資産の取得が必要です。開発モードでは自動登録しません。未取得のJavaScriptなどがある場合やキャッシュ作成が失敗した場合は、すべての画面・機能のオフライン動作を保証できません。

## 文書

| 文書 | 位置づけ |
| --- | --- |
| [実装状況と文書整合確認](docs/implementation-status.md) | 実装根拠、今回の修正、未実装・未検証事項 |
| [要件定義書](docs/requirements.md) | 現行機能要件と、未検証の非機能受入基準 |
| [設計書](docs/design.md) | 保存・生成・JSON・PDF・PWAの実装設計 |
| [画面設計書](docs/screen-design.md) | 現行UIと、残る画面改善案の区別 |
| [開発・デプロイ手順](docs/deployment.md) | 現行リポジトリのセットアップ、検証、Vercel設定 |
| [脆弱性対応結果](docs/security-audit-response-result.md) | 依存更新、期限付き開発依存例外、検証結果と未実施範囲 |

旧`tennis-organizing-app`の資料は履歴として保持しています。現行のセットアップ手順には使用しません。

- [旧要件・設計方針](docs/requirements-design.md)
- [旧ver1.00リリース範囲](docs/release-v1.00-scope.md)
- [旧Firebase本番設定](docs/firebase-production-setup.md)
- [旧Vercel本番設定](docs/vercel-production-setup.md)
- [旧PWA静的キャッシュ設計](docs/pwa-service-worker-design.md)
- [旧フローティングナビゲーション設計](docs/floating-navigation-ui-design.md)
- 旧PDFレイアウト参考：[2コート](docs/pdf-layout-portrait-2-courts.png)、[3コート](docs/pdf-layout-portrait-3-courts.png)

## 開発・検証

CIと同じNode.js 24を基準とします。アプリ用の環境変数やAPIキーは不要です。

```powershell
npm ci
npm run dev
```

開発URLは `http://localhost:3000` です。

```powershell
npm run lint
npx --no-install tsc --noEmit
npm test
npm run test:security
npm run audit:security
npm run build
npx playwright install chromium
npm run test:e2e -- --workers=1
```

E2EはChromiumのみを設定し、本番ビルドを `http://localhost:3001` で起動します。対象ケースだけ実行する方法、既存サーバー再利用時の注意点、CIの範囲は [開発・デプロイ手順](docs/deployment.md) を参照してください。E2E全件実行やクロスブラウザー検証を今回の文書確認で実施したという意味ではありません。

監査は本番依存の検出をすべて失敗扱いとし、開発依存も含めて確認します。2026-10-06の更新後は本番0件、全依存はbraces由来のHigh 5件です。これらだけをアドバイザリ・版・配置・開発依存に限定して2026-10-20 09:00 JSTまで例外化しています。期限切れ・別の検出・通信失敗はCIを失敗させます。詳細は [脆弱性対応結果](docs/security-audit-response-result.md) を参照してください。

アプリ表示・バックアップのバージョンは `package.json` の `version`（現在`1.1.0`）を参照します。npm package名は旧名`tennis-organizing-app`が残っています。現行の公開URL・Vercel Project名はリポジトリ内に確定情報がないため、旧READMEのURLをMatchupLabの公開先として案内しません。
