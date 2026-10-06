# MatchupLab 開発・デプロイ手順

最終整合確認日: 2026-10-06。旧Firebase/API構成の設定は [履歴資料](./vercel-production-setup.md) として扱う。

## 1. セットアップ

GitHubリポジトリは `Bamboosato/matchup-lab`。CIに合わせNode.js 24を使用する。

```powershell
npm ci
npm run dev
```

開発サーバーは `http://localhost:3000`。現行アプリはFirebase・外部組合せAPIを使用せず、`.env.local`、APIキー、Firebase CLI、Firestore Rulesの配備は不要である。Service Workerの自動登録はproductionのみであり、開発モードでの確認をオフライン検証の代わりにしない。

## 2. 検証コマンドと範囲

テスト観点を先に整理し、機能・非機能・データ・UIと、正常系・異常系・境界値・状態遷移を分ける。修正範囲に応じてE2Eを未実施／対象ケースのみ／クロスブラウザー／全件から選び、理由・未実施範囲・環境・証跡を記録する。

```powershell
npm run lint
npx --no-install tsc --noEmit
npm test
npm run test:security
npm run audit:security
npm run build
```

単体はVitest、IndexedDBテストはfake-indexeddbを使用する。これは実端末の容量制限・保存拒否・複数タブ競合をすべて再現するものではない。

本番モードでの手動確認：

```powershell
npm run start
```

E2Eの前に本番ビルドを完了させる。初回はChromiumを用意する。

```powershell
npx playwright install chromium
npm run test:e2e -- --workers=1
```

対象ケースのみの例：

```powershell
npm run test:e2e -- e2e/matchup-route-retention.spec.ts --grep "deletes a member only after confirmation" --workers=1
```

`playwright.config.ts` は `http://localhost:3001` に `next start` を起動する。`reuseExistingServer: true` のため、別のビルドで起動したサーバーが3001番に残っていると、最新ソースを検証できない。実行前に対象サーバーのビルドを確認し、このプロジェクトの古いサーバーなら停止して起動し直す。同一実機へE2Eを並列実行しない。

設定済みのprojectはChromiumのみで、Firefox／WebKitの成功を意味しない。2つのspecはルート間の結果保持、削除確認、JSON復元、モバイル表示、manifest・アイコン・キャッシュ境界等を扱う。オフライン再起動・PDF・更新・性能・実機の全受入基準を自動で網羅してはいない。traceは `on-first-retry` であり、通常の初回成功実行で必ず生成されるわけではない。

## 3. CI

`.github/workflows/ci.yml` はmainへのpushとmain向けPull Requestで、Node.js 24上で依存インストール、lint、型チェック、Vitest、監査ポリシーテスト、npm audit、build、Chromium E2Eを実行する。

CIのインストールは `npm ci --no-audit --prefer-offline --progress=false`。インストールと監査を分け、テストの後、buildの前に `npm run audit:security` を実行する。スクリプトは `npm audit --omit=dev --audit-level=low --json` と `npm audit --include=dev --audit-level=low --json` の両方を実行し、本番依存の検出は例外なく失敗させる。全依存の検出も失敗対象とし、下記の開発依存例外だけを期限内に許可する。通信失敗、不正JSON、監査形式・件数の不整合、設定欠落は成功扱いにしない。`npm audit fix` や依存バージョンの自動変更は行わない。

未修正の `GHSA-vfj7-8cjw-p6xm` に限り、[security-audit-exception.json](../security-audit-exception.json) のbraces 3.0.3、micromatch 4.0.8、fast-glob 3.3.1、@next/eslint-plugin-next 16.3.8、eslint-config-next 16.3.8を2026-10-20 09:00 JSTまで例外化する。lockfileの `dev: true`、版、ルートの `node_modules/<package>` 配置、viaの根拠が一致する場合だけ許可し、Criticalは許可しない。期限の自動延長はしない。対応手順・残るリスクは [対応結果](./security-audit-response-result.md) に記録する。

監査件数・例外適用をActionsログへ表示し、生のJSONを `.security-audit/production.json` と `full.json`、判定を `policy.json` に保存する。実行開始時にレポートを初期化し、失敗時に古い成功結果を残さない。最後の `if: always()` で3ファイルを `dependency-audit` artifactへ保存する。監査前の失敗でレポートがなければアップロードを省略する。

参考にした `tennis-organizing-app` の独立監査・artifact保存・限定例外の方針を採用した。期限はMatchupLab固有で、参照先のFirebase SDK検証は追加していない。生の `npm audit --include=dev --audit-level=low` は例外判定をしないため、既知のHigh 5件が残る間は終了コード1になる。監査の公式仕様は [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/) を参照する。

CIとPlaywrightのwebServer設定には旧Firebaseのダミー環境変数が残るが、現行ソースは参照せず、本番の必須設定ではない。

## 4. Vercelへの配備

GitHub連携する場合は `Bamboosato/matchup-lab` を選び、Framework PresetをNext.js、Production Branchをmainとする。ビルドは `npm run build`、Output DirectoryはNext.jsの既定値を使用する。アプリのためにFirebase・外部API環境変数を追加する必要はない。

この記載は配備手順であり、現在のVercel Project・ドメイン・GitHub連携設定を実環境で確認した記録ではない。旧`tennis-organizing-app`のURL、project ID、release tagをMatchupLabへ流用しない。デプロイ後は実際の配信先でルート、保存、生成、PDF、JSON、manifest、Service Workerのヘッダーと更新を確認する。

ブラウザの保存領域はオリジンごとに異なる。Preview URLとProduction URL、別ドメインのメンバーは共有されない。切替前にJSONを出力し、必要なオリジンへ確認付きで復元する。
