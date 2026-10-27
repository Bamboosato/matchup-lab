# npm audit検出への対応結果

最新の再評価は以下の2026-10-27記録を参照。**例外は無効（`security-audit-exception.json` は `null`）**。旧期限2026-10-27 09:00 JST（2026-10-27T00:00:00Z）の延長は行わない。第1〜5章は2026-10-06、第6章は2026-10-19時点の履歴であり、当時の検出・期限・未実施事項を含む。

## 2026-10-27: 残存依存findingの限定修正

PR #9のマージを確認し、main f5b1fd41203aecfcc1e02794177a82a7a1a84123 から再監査した。productionはCritical 2 / High 1の3 package、fullはCritical 2 / High 2 / Moderate 2の6 packageで、10月26日の検出と一致した。これはnpm auditのpackage別finding数であり、GitHub alert数ではない。

| 対象と経路 | 更新 | 根拠 |
| --- | --- | --- |
| Next.js（アプリ実行基盤） | 16.3.8 → 16.4.1 | GHSA-2464-fhr4-w9xw / GHSA-p3m5-59mp-jv5r / GHSA-673q-mjm6-r5xrの最初の修正版 |
| jsPDFの任意依存DOMPurify | 3.4.16 → 3.4.17 | GHSA-cg2g-xh64-v4q7 / GHSA-mrv2-3pqr-j5jr / GHSA-c6gr-qvv4-5v3f |
| Zod（JSON取込・対戦条件検証） | 4.4.3 → 4.6.6 | GHSA-mrhx-c7xc-m3w5 |
| Vitest → @vitest/mocker | 4.1.11 → 4.1.12 | GHSA-qxg6-89mg-rqv8 / GHSA-xp26-3454-mjgp |
| Vitest → Vite | 8.3.2 → 8.3.5 | 既存PR #8のnpm生成lockfile差分を再利用。launch-editorとViteの6 advisoryを解消 |

Nextは完全固定指定のためmanifestの1行を更新した。その他は既存の親依存範囲内のlockfile更新とし、Nextのenv/SWC、Vitest内部package、PR #8のRolldown/OXC更新だけを伴う。npm生成時の無関係なpeer metadata・Tailwind任意依存の差分は採用せず、最終lockfileからのnpm ci成功を確認した。ESLint設定、React、TypeScript、Tailwind、監査ポリシー、例外null、workflowは変更しない。PR #8を変更・閉鎖せず、#9の例外廃止を再実装しない。

到達性の調査ではZodは利用者が選択するJSONファイルの検証に使われる。DOMPurifyはPDFのtext/table出力からの脆弱なHTMLモード呼出を確認できず、Nextの画像は固定PNGかつunoptimizedでServer Actions/use cacheは見つからない。Vite/mockerは開発用で、これらの実際の攻撃到達性は未証明。依存の修正版への更新と回帰検証を行い、任意サイズの取込ファイルに対するメモリ上限まで保証するものではない。

PCS251873 / Node 24.22.1 / npm 11.19.1で、npm ci、lint、tsc --noEmit、unit 53件、policy 29件、build、Chromium E2E 16件が成功した。production/full auditは両方0件、exceptedは空。上限付きarray/setの64要素の拒否と通常入力、jsPDFのtext出力も小さな境界確認で成功した。PDFの実ダウンロード・任意サイズ入力の資源上限や全advisoryの攻撃再現までは確認していない。最終head CI・Previewはローカルと分けて今回のdraft PRへ記録する。過去の検出と検証記録は以下に保持する。

## 2026-10-26: 撤回済み例外の廃止

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) は公式情報で2026-10-23にwithdrawnとなった。最新main `3e5d56019752310e91b8c1d382c17ad204feecbd` のlockfileで `npm audit --omit=dev --json` と `npm audit --include=dev --json` を再取得し、当該braces advisoryとその旧5 package経路が検出されないことを確認した。この5経路は過去の1 advisoryに由来する履歴であり、現在の5脆弱性を意味しない。

現在の別findingはproductionがCritical 2 / High 1の3 package（dompurify、next、zod）、fullがCritical 2 / High 2 / Moderate 2の6 package（上記とvite、vitest、@vitest/mocker）。生監査はいずれも終了1で、例外無効化後のポリシーもこれらを拒否する。Viteの既存PR #8を含め依存更新は今回の対象外とし、監査ゲートや閾値を緩和しない。

設定の `null` を「例外なし」と解釈し、旧期限の直前・一致・直後も旧経路を拒否するテストと、両監査の全severityの新規finding拒否テストを追加した。空の監査のみ成功し、欠落設定・不正応答・通信失敗の拒否と生レポート保存は継続する。

ローカルはNode 24.22.1 / npm 11.19.1で `npm ci --no-audit --prefer-offline --progress=false`、lint、`tsc --noEmit`、unit 53件、ポリシー29件、build、Chromium E2E 16件が成功した。`npm run audit:security` は上記の別findingで終了1（exceptedは空）。最終headのCIとPreviewはローカル結果と分けて対応するdraft PRに記録する。

実施日: 2026-10-06。対象: MatchupLab。承認された [対応案](./security-audit-response-plan.md) に沿って依存更新とCI監査ポリシーを実装した。本書はPR作成前のローカル検証記録であり、以下の実施・未実施範囲はその時点を指す。GitHub上でのCI・マージ・配備の結果は、対応するPRとActionsの記録で確認する。

## 1. 結果

| 監査対象 | 更新前 | 更新後 |
| --- | --- | --- |
| 本番依存 | Critical 1、High 2、Moderate 1、Low 1、計5件 | **0件** |
| 全依存（開発を含む） | Critical 1、High 9、Moderate 3、Low 1、計14件 | **High 5件**。その他0件 |

修正版のある9件を解消し、Criticalは0件になった。残る5件は開発用の1アドバイザリ `GHSA-vfj7-8cjw-p6xm` が親パッケージへ伝播した検出である。解消ではなく、期限付きでリスクを受容している。

`npm run audit:security` は終了0。これは例外条件を満たした判定であり、全依存の脆弱性0件を意味しない。生の全依存監査は既知のHigh検出を返す。

## 2. 更新した依存

| 対象 | 更新前 | lockfileの更新後 |
| --- | --- | --- |
| next / eslint-config-next / @next/eslint-plugin-next | 16.3.1 | 16.3.8 |
| vitestと@vitest関連 | 4.1.6 | 4.1.11 |
| sharp | 0.35.3 | 0.35.5 |
| source-map-js | 1.2.1 | 1.2.2 |
| brace-expansion | 1.1.18 / 5.0.9 | 1.1.21 / 5.0.12 |
| js-yaml | 4.3.1 | 4.3.2 |
| fflate | 0.8.2 | 0.8.3 |
| dompurify | 3.4.14 | 3.4.16 |

直接依存を更新し、間接依存は既存の要求範囲内で解決した。Next.js・sharp・Vitest系のプラットフォーム別パッケージと関連依存も同期され、Vitestの依存解決でVite 8.3.2・Rolldown 1.2.12等へ更新された。既存postcss override 8.5.26を保持し、新たな一括overrideやメジャー変更を追加していない。

## 3. CIと期限付き例外

参考にしたtennis-organizing-appの独立監査・artifact保存・限定例外の方針を採用した。参照プロジェクトは変更していない。

追加・変更した主なファイル：

- [package.json](../package.json)、[package-lock.json](../package-lock.json)：更新版と `test:security` / `audit:security` コマンド。
- [security-audit-exception.json](../security-audit-exception.json)：アドバイザリ、具体的な版、期限、担当、理由。
- [security-audit-policy.mjs](../scripts/security-audit-policy.mjs)：本番検出と例外条件の判定。
- [security-audit.mjs](../scripts/security-audit.mjs)：本番・全依存の監査実行とレポート保存。
- [security-audit-policy.test.mjs](../scripts/security-audit-policy.test.mjs)：判定・実コマンド起動・障害処理の25テスト。
- [ci.yml](../.github/workflows/ci.yml)：監査テスト、監査、常時artifact保存。インストール後、build前に監査する。

当初の例外期限は **2026-10-20 09:00 JST（2026-10-20T00:00:00Z）**。対象は次のルート配置の開発依存だけである。

```text
eslint-config-next 16.3.8
  → @next/eslint-plugin-next 16.3.8
    → fast-glob 3.3.1
      → micromatch 4.0.8
        → braces 3.0.3
```

本番監査の検出は例外なく失敗させる。全依存でも、lockfileの `dev: true`、正確な版、`node_modules/<package>` 配置、viaをたどった根拠が記録したアドバイザリだけであることを確認する。Critical、別アドバイザリ、追加配置、版変更、期限一致以降は失敗する。監査通信・子プロセス失敗、不正JSON、形式・件数不整合、設定欠落、レポート作成失敗も成功扱いにしない。

生のレポートを `.security-audit/production.json` と `full.json`、判定を `policy.json` へ保存し、件数と例外対象・期限をログへ表示する。レポートは実行開始時に初期化し、前回の成功を誤って流用しない。Actionsの `dependency-audit` artifactは `if: always()` で保存する。隠しディレクトリの監査JSONを保存するため `include-hidden-files: true` を指定する。アップロード対象は `.security-audit/*.json` に限定し、他の隠しファイルを含めない。ローカルレポートはgit対象外。

期限前に上流の修正版を確認し、親依存とlockfileを更新して両監査を再実行する。5件を解消した場合は、例外ファイル・例外分岐・関連テストを一緒に整理する。ファイルだけ削除すると現行判定は失敗する。期限の自動延長はしない。期限後も当該検出が残ればCIは失敗する。修正済みで全依存0件なら、古い例外が期限切れでも成功する。

## 4. 検証観点と結果

実行前に [対応案のテスト観点](./security-audit-response-plan.md#6-実装後のテスト計画) を整理した。機能は生成・出力・監査、非機能はビルド・ネイティブ依存・オフライン・障害処理、データは保存・復元・例外とlockfileの一致、UIはルート・狭幅操作・PDF・エラーを対象とした。

正常系、異常系、境界値、状態遷移を分け、Windows・Node.js 24.13.0・Chromiumで検証した。専用ブラウザープロファイルとテスト用IndexedDBを使用し、通常利用者の保存データを変更していない。3001番に既存サーバーがないことを確認し、更新後の本番ビルドを起動した。同一実機のブラウザー操作は直列。

| 検証 | 結果 | 意図・範囲 |
| --- | --- | --- |
| lint / TypeScript | 成功 | 更新後のESLint設定と型互換性。最終lintは警告なし |
| Vitest | 11ファイル・53テスト成功 | Vitest更新のため既存単体を全件実行。生成・データ・JSON・PDFモデル等 |
| 監査テスト | 25テスト成功 | 16件の判定テストと9件の実行・障害処理テスト |
| 実監査 | 本番0、全依存High 5、ポリシー終了0 | 修正対象9件の消滅と例外対象の実値一致 |
| 本番build | 成功 | Next.js 16.3.8による全routeの静的生成 |
| Windows sharp | AVIFエンコード・読み込み成功 | sharp 0.35.5 / libvips 8.18.7、2×2画像でネイティブ依存の動作を確認 |
| 対象E2E | Chromium 12件成功、1 worker | 下記の影響範囲を選定 |
| 追加ブラウザー操作 | 正常系・境界・状態遷移成功 | 3モード、最小人数、30人、8面入力、20回、PDF、オフライン |
| PDFの解析・描画 | 8PDF・計20ページ | A4縦、日本語名、ページ番号、全ページのPNGによる表示確認 |
| PDFフォント障害 | エラー表示・操作復帰成功。再試行だけでは回復しない | 第5章に既存問題と再読み込みによる回復を記録 |
| 文書・CI・差分 | リンク・記法・CI構造・空白を確認 | README・開発手順・実装状況・対応案を現状へ同期 |

監査テストは、本番への混入、新しいLowやCritical、viaの未知・循環・欠落、異なる版・配置、不正な結果・設定、期限直前／一致／直後を検証する。ローカルnpmスタブによる実行テストでは終了0／1／2、通信エラー形式、不正JSON、設定・lockfile・npm起動情報の欠落、レポート保存不能、古い成功レポートの除去を確認した。障害処理テストはネットワーク実障害を起こすものではない。

E2Eは**対象ケースのみ**を選択。Next.js共通基盤更新の影響があるルート間結果保持、Guest入力、削除と選択件数、ホーム保存表示、確認付き削除・JSON復元、320／390pxの操作、manifest・Workerヘッダー・静的キャッシュ境界・favicon・アイコンURLを選んだ。既存16件中12件を実行し、メニュー時のスクロール幅、バックアップボタン配置、復元ダイアログ単独表示、旧スプラッシュ非表示の4件は未実施。CI設定自体は既存どおりChromium全件を実行する。

追加操作は、登録メンバー1人と当日ゲストを使用。ダブルス4人・1面・1回、8人・2面・4回の3モード、30人・8面入力・20回（確認後7面）、シングルス2人・1面・1回と30人・8面・20回を確認した。日本語10文字の表示名と長い開催名をPDFへ出力し、最大条件は各7ページでラウンド・改ページ・フッターを確認した。長い開催名は既存設計により省略記号で短縮される。

オンラインで必要資産を取得した後、オフライン再読み込み・別形式への移動・生成・PDFを確認した。模擬旧Workerとv2キャッシュを作り、更新表示→利用者の更新操作→現行Worker制御→v2削除→オフライン再起動・PDFも確認した。模擬旧Worker用ファイルは検証後に削除した。

証跡は `.security-audit/`、`output/playwright/` の操作コード・8PDF・ページ画像・PDF解析JSON、`.playwright-cli/` のスナップショット・コンソールログに保存した。既存のローカル成果物は保持している。これらはローカル検証資料であり、すべてをGitHub文書へ追加する意図ではない。

## 5. 検証で確認した既存制約と未実施範囲

### PDFフォント失敗後の再試行

1. 本番モードで対戦表を作成し、Service Workerをテスト時だけ迂回する。
2. `/fonts/NotoSansJP-VF.ttf?v=20260512` をテスト用にHTTP 500へ置換してPDF作成する。
3. エラー表示とPDFボタンの有効状態への復帰を確認する。
4. 障害を解除して同じ画面で再試行しても、失敗済み `fontBytesPromise` が残るため同じエラーになる。
5. 再読み込みして結果を作成し直すとPDF出力が成功する。再読み込みで条件・結果は初期化され、永続メンバーは残る。

`src/features/matchups/pdf/exportMatchupPdf.ts` は更新前HEADと完全に同一で、取得失敗時にPromiseを解除しない実装が残っていることを確認した。依存更新による新しい差分ではない。分類は**既存の実装問題**、通常出力を妨げないが一時的通信失敗後の復帰を妨げる。今回は依存・CI対応の範囲で記録し、アプリのPDF処理は変更していない。後続修正では失敗Promiseの解除と失敗→再試行の観点を追加する。

### その他

- オフラインで `/matchuplab-icon.png` とRSC prefetchの通信エラーを確認した。ブランド画像のキャッシュ対象外等は既存設計の制約。生成・PDF・メンバー保持は成功しているが、完全なオフライン表示成功とは扱わない。
- 模擬旧Workerの切替は成功したが、実際の旧Next.jsビルドのHTML・JSチャンク混在、配信先の旧キャッシュ、CDN更新は未検証。
- Linux上のnpm ci・build・sharp、実際のGitHub Actionsとartifactアップロードは未実施。workflowへ検証を設定済みだが、pushして実行した結果ではない。
- Firefox／WebKit、iOS Safari、モバイル実機、性能p95、保存容量・権限拒否、複数タブ競合、更新中の保存操作は未実施。単体テストの保存失敗確認を実ブラウザーの容量制限試験とは扱わない。
- Vitestには将来のVite native config loaderに関する設定互換性警告が残る。現在の実行は終了0で、今回この設定形式は変更していない。
- 通常のローカル実行ではNext.jsやNodeテストの子プロセス起動が `EPERM` になったため、同じコマンドを制限外で実行して成功した。分類は環境制限。CIの実環境成功を代替する証明ではない。

## 6. 2026-10-19の短期延長

利用者の明示承認に基づき、期限を2026-10-20T00:00:00Zから **2026-10-27T00:00:00Z（10月27日09:00 JST）** へ1週間延長する。対象GHSA、5パッケージの版・配置・開発依存条件、Critical・本番・別advisoryの拒否条件は変更しない。自動延長は導入しない。修正版公開、依存経路変更、追加検出があれば再評価し、期限到達時はCIが失敗する。

### 判断根拠と生監査

remote mainは `78f88c1c05ac06c49cd191f471d58e9d0bab4eb1`。open PRはなく、元の `C:\work_codex\matchup-lab` に残る未追跡の `.playwright-cli/` と `output/` は保護し、別のcloneで作業した。適用対象のAGENTS.mdは見つからなかった。

2026-10-19 UTCに新規取得した生監査は次のとおり。例外適用前の結果とポリシーの成功は区別する。

| 実行 | 生の結果 | 終了コード |
| --- | --- | --- |
| `npm audit --omit=dev --audit-level=low --json` | production 0件、全severity 0 | 0 |
| `npm audit --audit-level=low --json` | full High 5件、その他0 | 1 |

fullの実アドバイザリは [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) だけ。親4件は同じadvisoryの派生検出で、viaは第3章の経路と一致した。lockfileの5件はすべて同じ版・ルート配置・`dev: true` であり、追加配置はない。

GitHub Advisoryはbraces <=3.0.3が対象、Patched versionsはNone。npm registryのlatestもbraces 3.0.3である。Next / eslint-config-next / @next/eslint-plugin-nextのlatestは16.4.2だが、最新eslint-config-next → plugin 16.4.2 → fast-glob 3.3.1の依存が残る。したがって最新版への追従だけでは解消しない。npmの `fixAvailable` はeslint-config-next **14.2.35へのmajor変更**を提案しており、braces修正版の公開を示さない。今回package.json・lockfile・アプリを変更しない。

[get-root-dirs.ts（v16.3.8）](https://github.com/vercel/next.js/blob/v16.3.8/packages/eslint-plugin-next/src/utils/get-root-dirs.ts) とインストール済みの配布コードを確認した。`settings.next.rootDir` が文字列または配列の場合にfast-globを呼び、未指定時はcwdを返す。現eslint.config.mjsと読み込まれる設定にrootDir指定はない。これは現設定での到達性を限定する根拠であり、脆弱性の修正や開発ツール全体の安全性の保証ではない。設定に外部由来のパターンを追加する場合は再評価する。

生JSONは隔離作業ディレクトリの兄弟 `security-recheck/production.json` と `full.json` に保持した。初回取得分のSHA-256はそれぞれ `7ba453ba5acb1bdf1e6e41a8e09e988fe5b1fceb5f7e469bebb96fea3a75467f`、`968f482e250782fe909672ac3d355c57f287821b24db719c52348c347d02b46b`。CIの再監査は既存どおり `.security-audit/*.json` を `dependency-audit` artifactへ保存する。

### 検証とPRの範囲

今回の変更対象は例外期限、本章、監査境界テストのみ。既存fixtureの期限を更新し、修正済みツリーの期限後テストを相対日時にした。加えてコミット対象の例外JSONそのものを読み、2026-10-27T00:00:00Zの1ms前・一致・1ms後を検査する。直前だけ許可し、一致・直後は拒否する。

Windows・Node.js 24.13.0で以下を実施した。ログは兄弟 `security-recheck/` に保持し、実監査の再取得分は `.security-audit/` に保存した。

| 検証 | 今回の結果 |
| --- | --- |
| `npm ci --no-audit --prefer-offline --progress=false` | 成功。package.json・lockfileのSHA-256は作業前後で一致 |
| `npm run test:security` | 28/28成功。新advisory、版・配置・dev属性変更、不正JSON、通信・プロセス失敗の拒否も維持 |
| `npm run lint` / `npx --no-install tsc --noEmit` | 成功。型検査は同じローカルtscを直接起動 |
| `npm test` | 11ファイル・53/53成功。既知のVite設定形式の将来互換性警告は残る |
| `npm run audit:security` | 終了0。production 0、full High 5、excepted 5、blocked 0。2026-10-19T01:00:56.457Z取得 |
| `npm run build` | 成功。Next.js 16.3.8で静的生成完了 |
| `npm run test:e2e -- --workers=1` | Chromium全16件成功。3001番の既存サーバーがないことを確認して実行 |
| 例外・差分確認 | expires以外の例外JSONは旧mainと同一。変更は3ファイル、`git diff --check` 成功 |

有効ESLint設定から `getRootDirs` を実行して、rootDir未指定・返り値cwd・glob呼び出し0回も確認した。通常環境のインストールはDNSのENOTFOUNDで中断し、検証用処理を制限外で再実行して成功した。依存やゲートの変更で回避していない。LinuxのGitHub Actionsによる結果と最終PR headの照合はPRのChecks／Actionsを正とする。

PR操作前に既存のGitHub deploymentとstatusを確認した。Vercel botは過去のPR headをPreviewへ自動deployし、mainをProductionへdeployしている。文書の「Previewを使用しない」方針とは別に、自動連携の履歴がある。今回もbranch push／PR作成でPreviewが発生する可能性がある。本作業の範囲はdraft PRまでで、merge・mainへの直接push・本番deploy・Vercelや環境変数の設定変更・アラート却下は行わない。
