# npm audit検出への対応案

検討日: 2026-10-06。対象: MatchupLab。本書は依存更新前の調査と対応計画を記録する。ユーザー承認後に同日実装し、依存更新と限定例外を導入した。**現在の版・監査・検証結果は [脆弱性対応結果](./security-audit-response-result.md) を参照。** 以下の現行・未実施という表現は検討時点を指す。

## 1. 推奨方針

まず修正版が公開されている9件を、同じメジャー系列の更新で解消する。最優先は `next: 16.3.1 → 16.3.8` とし、`eslint-config-next` も16.3.8へ揃える。その後、残る開発用bracesの1アドバイザリから派生した5件について、厳格CIを継続して上流修正を待つか、条件を限定した期限付き例外を採用するかを決める。

CIの運用継続が必要なら、参照先tennis-organizing-appと同じ考え方の**開発依存限定・アドバイザリ限定・バージョン固定・期限付き例外**を推奨する。ただし例外は脆弱性の解消ではなく、残るリスクの一時受容である。更新後の実監査と回帰検証を完了させてから適用を判断する。

`npm audit fix --force` の一括適用、Next.js／ESLint設定の14系へのダウングレード、`--omit=dev` だけによるCI通過、High全体を除外する閾値変更は採用しない。

## 2. 更新前の監査結果と件数の意味

| 実行 | 終了コード | 検出 |
| --- | --- | --- |
| `npm audit --include=dev --audit-level=low --json` | 1 | Critical 1、High 9、Moderate 3、Low 1、計14件 |
| `npm audit --omit=dev --json` | 1 | Critical 1、High 2、Moderate 1、Low 1、計5件 |

14件はnpm auditの依存パッケージ別の検出件数であり、独立した14個のアプリ不具合を意味しない。Next.jsの1件には3つのCriticalアドバイザリが含まれる。また、bracesの1つの問題が親パッケージへ伝播し、5件のHighとして報告されている。

本番依存5件と開発依存9件を区別する。本番依存として検出されることと、現在のアプリから脆弱な処理へ到達できることも別である。ただし、到達経路がソース検索で見つからないことを理由に本番依存の更新を省略しない。

## 3. 更新候補

| 優先度／影響 | 対象・現行バージョン | 対応候補 | 検出件数 | 更新方法・互換性確認 |
| --- | --- | --- | --- | --- |
| 致命・本番 | next 16.3.1 | 16.3.8 | 1 Critical | 現在の安定版をnpmレジストリで確認。eslint-config-nextも同版へ揃え、App Router・静的資産・PWAを回帰確認 |
| 重大・本番 | sharp 0.35.3 | 0.35.4以上の同系列 | 1 High | next 16.3.8は `sharp: ^0.35.4` を要求。lockと実際のネイティブ依存をWindows・Linuxで確認 |
| 重大・本番依存を含む | source-map-js 1.2.1 | 1.2.2 | 1 High | postcssの `^1.2.1` 内で更新できる。既存postcss override 8.5.26は保持し、CSSビルドを確認 |
| 重大・開発 | brace-expansion 1.1.18／5.0.9 | 1.1.21／5.0.12 | 1 High | minimatchの要求 `^1.1.7`／`^5.0.5` 内でそれぞれ更新。1系を5系へ一律overrideしない |
| 重大・開発 | js-yaml 4.3.1 | 4.3.2 | 1 High | @eslint/eslintrcの `^4.1.1` 内で更新。lintと設定読み込みを確認 |
| 中程度・開発 | vitest／@vitest/mocker 4.1.6 | 4.1.11以上の修正済み4系 | 2 Moderate | 4.1.11の公開とNode.js条件を確認。Vitest関連パッケージを同じ版へ揃え、既存単体テストを再実行 |
| 中程度・本番 | fflate 0.8.2 | 0.8.3 | 1 Moderate | jsPDFの `^0.8.1` 内で更新。日本語PDFの生成・ダウンロードを確認 |
| 軽微・本番 | dompurify 3.4.14 | 3.4.16 | 1 Low | jsPDFの `^3.3.1` 内で更新。PDF出力を確認 |
| 重大・開発、上流未修正 | braces 3.0.3とESLint経路 | 第5章で別途判断 | 5 High | 公開済み修正版なし。eslint-config-next 16.3.8への更新だけでは除去されない |

更新可能9件と残る5件の見込みは、現在のアドバイザリ・要求範囲からの判断である。更新したlockfileでの再監査はまだ実施しておらず、新しい検出や依存解決結果が変わる可能性がある。

推奨する実装は、まず直接依存のNext.js・ESLint設定・Vitestを更新し、間接依存は親の要求範囲内でlockfileを更新する。間接依存を直接依存として追加する必要はない。overrideは、通常の解決で安全な版へ更新できない場合にだけ、親と対象を限定して検討する。

### 修正根拠

- Next.js：Windows上のサーバーのRCEとAVIF画像最適化の問題は16.3.3、next/ogのRCEは16.3.6が修正版。候補16.3.8はこれらを上回り、公式npmレジストリのlatestも16.3.8だった。[Windows RCE](https://github.com/advisories/GHSA-p293-qw3h-jr36)、[AVIF画像最適化](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)、[next/og](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)、[next 16.3.8の依存情報](https://registry.npmjs.org/next/16.3.8)。
- sharp：[0.35.4での修正](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)。
- source-map-js：[1.2.2での修正](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)。
- brace-expansion：[1.1.21／5.0.12での修正](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr)。現在の監査は同パッケージの他の再帰DoSも検出しており、全アドバイザリが消えたことを再監査で確認する。
- js-yaml：[4.3.2での修正](https://github.com/advisories/GHSA-2883-xcg3-v3hh)。
- Vitest／mocker：[4.1.11での修正](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)。
- fflate：[0.8.3での修正](https://github.com/advisories/GHSA-px8p-9vwx-vf98)。
- DOMPurify：[IN_PLACEのフック問題](https://github.com/advisories/GHSA-p98j-92pf-mc4p)、[IN_PLACEのrawtext問題](https://github.com/advisories/GHSA-6688-9rhm-gjv2)。いずれも3.4.16が修正版。

## 4. このアプリでの到達経路

| 項目 | 確認した実装 | 判断の限界 |
| --- | --- | --- |
| WindowsサーバーのNext.js RCE | App Routerを使用。Next.js設定にCache Componentsの有効化はない | Windowsでの公開サーバー運用があれば優先度が高い。現在のproductionホスト・公開範囲は未確認 |
| AVIF／sharp | next/imageの使用箇所はヘッダーのPNGで `unoptimized`。アップロード・外部画像設定はソース検索で見つからない | 該当表示経路の画像最適化利用は見つからないが、サーバーの画像エンドポイント全体を無効化した証明ではない |
| next/og | next/og、ImageResponse、動的OG画像の実装はsrc内に見つからない | 現行の直接利用は見つからない。Next.js自体は更新する |
| DOMPurify／fflate | jsPDFの間接依存。srcにDOMPurify直接呼出し、doc.html、html2canvas、unzip利用は見つからない | 既存PDF経路の到達性が低いと推測するが、未到達を保証するものではない |
| Vitest | Node側の単体テストを使用し、browser modeや公開mockerPluginの設定はない | アドバイザリの主な悪用条件は見つからない。公開開発サーバー等の全実環境は未確認 |
| braces・brace-expansion・js-yaml | ESLint・ファイル探索・設定読み込みの開発経路。アプリの参加者入力をglob／YAMLへ渡していない | 本番利用者の直接入力経路は見つからない。CIや開発のDoSリスクは残る |

到達経路の判断は、ソースと設定に基づく推測を含む。攻撃コードの実行やproductionへの侵入試験は行っていない。

## 5. braces由来5件の扱い

現在の経路は次のとおり。全ノードはlockfile上で開発依存である。

```text
eslint-config-next 16.3.1
  → @next/eslint-plugin-next 16.3.1
    → fast-glob 3.3.1
      → micromatch 4.0.8
        → braces 3.0.3
```

Next.jsのESLint設定を16.3.8に揃えても、pluginは引き続きfast-glob 3.3.1を要求することを公式npmレジストリで確認した。bracesは公開最新版3.0.3で、[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) の修正版は未公表である。

| 選択肢 | 評価 |
| --- | --- |
| 厳格な監査を継続し、上流の修正版を待つ | 未修正の検出をCIで止め続ける。現行のLow以上失敗方針と整合するが、他のリリースも停止する |
| 限定的な期限付き例外 | CI運用を継続する必要がある場合の推奨案。未修正5件を明示し、本番依存や別アドバイザリを隠さない |
| ESLintのNext.js設定を置換・削除する | 依存除去は可能性があるが、Next.js固有ルールを失う・設定を再設計するため影響が大きい。最初の選択肢にはしない |
| npmが提示するeslint-config-next 14.2.35へ下げる | 現在のNext.js 16系とESLint設定から大きく変わる。自動fixとして採用しない |

### 期限付き例外の条件案

参照先tennis-organizing-appの監査ポリシーはこの同じ経路に限定した例外を持つ。MatchupLabへ導入するなら、その判定方式を参考に次の条件を満たす。

1. 本番依存の監査は例外なしで失敗判定し、更新後0件を必須とする。
2. 全依存の監査も継続し、例外を `GHSA-vfj7-8cjw-p6xm` だけに限定する。
3. 例外候補の版は、braces 3.0.3、micromatch 4.0.8、fast-glob 3.3.1、@next/eslint-plugin-next 16.3.8、eslint-config-next 16.3.8。更新後のlockfile実値と一致することを再確認する。
4. 対象ノードの `dev: true` と正確な版を検証する。同名でも本番依存化、別の配置・版、別アドバイザリがあれば失敗する。
5. 親パッケージへの派生検出も、viaをたどって同じアドバイザリだけに由来することを確認する。Criticalは例外化しない。
6. 期限案は2026-10-20 09:00 JST（2026-10-20T00:00:00Z）。期限切れは自動でCI失敗に戻す。期限・担当・根拠をファイルに記録し、自動延長はしない。
7. 不正JSON、監査通信失敗、期限・設定の欠落は成功扱いにしない。
8. 元の監査JSONと例外の適用結果をActionsログ・artifactへ残す。例外5件を「脆弱性0件」と表示しない。

現行CIは生のnpm auditを判定している。例外を採用するなら、終了コード1を無条件で成功に置き換えず、上記の監査ポリシースクリプトと対応テストを追加する必要がある。この計画ではまだ導入していない。

## 6. 実装後のテスト計画

### 先に確認する観点

- 機能：起動、登録・選択・生成、形式／モード、PDF、監査判定。
- 非機能：Windows／Linuxのネイティブ依存、Next.jsビルド、PWA更新・オフライン、監査通信障害。
- データ：IndexedDBと既存JSONの互換性、メンバー削除・復元、例外のlockfileとの一致。
- UI：ルート移動、モバイルの操作、PDF日本語・改ページ、処理中・失敗表示。

### ケースと検証意図

| 分類 | 対象 | 検証する意図 |
| --- | --- | --- |
| 正常系 | 更新後のlint・型チェック・既存単体テスト・build | ESLint・Vitest・Next.js更新による設定やAPIの破壊を検出する |
| 正常系 | 本番依存の監査0件、全依存は想定5件だけ | 更新対象9件が消え、予期しない問題が増えていないことを確認する |
| 正常系 | シングルス／ダブルス、3モード、Guest、PDF | Next.js・PDF間接依存更新後も主導線が成立することを確認する |
| 異常系 | 不正JSON・保存失敗・PDFフォント失敗 | 既存データやエラー動線を壊していないことを確認する |
| 異常系 | 監査レスポンス不正・通信失敗・別アドバイザリ・Critical | 監査ポリシーが誤ってCIを成功させないことを確認する |
| 境界値 | 形式別最小人数、30人、8面、20回、空復元、長い日本語 | 条件境界とPDFレイアウトを確認する |
| 境界値 | 例外期限の直前／一致／直後、dev→本番、版・配置の変更 | 例外が意図した範囲を超えて適用されないことを確認する |
| 状態遷移 | 条件作成→別ルート→戻る、JSON復元→再読み込み | セッション状態と永続メンバーの扱いを確認する |
| 状態遷移 | 旧Workerあり→更新→オフライン再起動・PDF | ビルド更新で旧チャンク・HTML・フォントが混在して動作を壊さないことを確認する |

### 実行範囲と前提

更新時は全単体テストを選ぶ。Vitest自体を更新するため、個別テスト成功だけでは設定・実行系の互換性を確認できない。

E2Eは「対象ケースのみ」を初期範囲とし、既存2specからルート保持、Guest、削除・復元、モバイル、manifest・アイコン・静的キャッシュのケースを選ぶ。Next.js共通基盤を更新するため、実装差分に症状が出た場合は範囲を広げる。自動化で不足する3モード・日本語PDF・オフライン更新は手動または対象E2Eを追加して確認する。Firefox／WebKit全件を既定にはせず、未実施範囲を結果へ記録する。

事前にバックアップを取得し、テスト用IndexedDBを初期化する。3001番の既存サーバーを確認し、古いビルドを再利用しない。同一実機のE2Eは直列で実行する。WindowsローカルとLinuxのGitHub Actionsでbuild・sharp等の依存解決を確認し、モバイル表示は少なくとも320px／390pxを対象にする。

ログ、監査JSON、lockfile差分、Playwrightの失敗trace／スクリーンショット、オフライン確認手順を保存する。失敗はテスト観点不足・データ・環境・実装に分類し、単発成功だけで再現性を判断しない。

## 7. 検討時点で実施した確認と未実施範囲

実施：全依存／本番依存の監査、現行lockfileの依存経路・要求範囲、修正候補のnpm公開状態、Next.js・Vitest等のNode.js条件、アドバイザリの修正版、srcと設定の到達経路調査、参照先の限定例外条件の読み取り。

Node.js 24のCI条件は、候補Next.js 16.3.8の `>=20.9.0`、Vitest 4.1.11の `^20 || ^22 || >=24` を満たす。これは更新後の実ビルド・テスト成功を保証するものではない。

未実施：package.json・lockfile変更、依存インストール、修正後の監査・lint・型チェック・単体・build・E2E、例外導入、GitHubへのpush、PR・マージ、デプロイ。今回の成果物はこの対応案だけである。
