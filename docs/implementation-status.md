# MatchupLab 実装状況と文書整合確認

確認日: 2026-10-06。

確認対象は `Bamboosato/matchup-lab` のmainコミット `3854466c6eaf002c4bdb5d5316fde7f2589b560b`。GitHubの `refs/heads/main` を読み取り、ローカルHEADとの一致を確認した。第1〜5章は文書整合確認時の記録で、文書のみを変更した。その後のCI監査追加は第6章、承認された脆弱性対応は第7章に記録する。GitHubへのpush、PR作成・マージ、デプロイは含まない。

## 1. 確認観点

| 観点 | 主な確認対象 |
| --- | --- |
| 機能 | メンバー管理、参加者選択、形式・モード、生成、結果、PDF、JSON |
| 非機能 | 認証・外部通信の依存、PWA、オフライン前提、性能、ブラウザ範囲 |
| データ | 保存範囲、削除、全置換、スキーマ検証、トランザクション、他タブ |
| UI | ルート、入力・エラー・確認・成功、モバイル操作、表示文言 |

正常系は登録→選択→生成→出力、異常系は不正JSON・保存／出力失敗、境界値は形式別最小人数・30人・99人・8面・20回・空バックアップ、状態遷移は確認の承認／取消・画面移動／再読み込み・削除／復元・オンライン／オフライン・Worker更新として分けた。複数タブや非同期処理の前提が崩れる場合は、実装根拠を確認できない保証を文書に追加しない。

## 2. 実装済み機能と根拠

| 項目 | 現行動作 | 主な根拠 |
| --- | --- | --- |
| 起動・ルート | ログインなし。ホーム・メンバー・ダブルス・シングルス | `src/app/layout.tsx`、各route page、`AppClientShell.tsx` |
| メンバー | IndexedDBの登録・編集・完全削除、有効99人、登録順／アイウエオ順 | `members/memberRepository.ts`、`members/sortKeyKana.ts`、`AppClientShell.tsx` |
| Guest・選択 | 当日ゲストと登録メンバーを合計30人まで。女性先行のゲスト01連番、仮入力をOKで確定 | `guests/buildGuestParticipants.ts`、`AppClientShell.tsx` |
| 生成 | 形式別人数、1〜8面、1〜20回、ダブルス3モード、過剰コート確認、同期ローカル生成 | `matchmaking/model`、`application`、`domain`、`matchups/generateMatchupLocally.ts` |
| 候補評価 | 24候補、seed間隔7919、スコア比較による最良候補選択 | `lib/constants/generation.ts`、`generateMatchupUseCase.ts` |
| 状態保持 | 形式別の条件・選択・結果は画面移動で維持、再読み込みで初期化 | `AppClientShell.tsx`、`e2e/matchup-route-retention.spec.ts` |
| PDF | A4縦、日本語フォント、コート・休憩者、ページ番号、条件に基づくファイル名 | `matchups/pdf/buildPdfDocumentModel.ts`、`exportMatchupPdf.ts`、`useMatchupPdfExport.ts` |
| JSON | schemaVersion 1、全レコード出力、型・ID・人数検証、確認後の全置換 | `members/memberJson.ts`、`memberRepository.ts`、`AppClientShell.tsx` |
| PWA | MatchupLab名とアイコン、production登録、HTMLと静的資産キャッシュ、更新・オフライン表示 | `manifest.ts`、`public/sw.js`、`components/pwa`、`next.config.ts` |
| モバイル | 860px以下でメニュー、メンバー操作を幅36pxのアイコンで1行に配置 | `globals.css`、`MemberListPanel`、対象E2E |

根拠のパスは `src/features/` 配下を一部省略している。上表はソースから確認した実装状況であり、すべての端末・異常条件での実行成功を意味しない。

## 3. 修正した文書の不整合

| 修正前 | 修正後 |
| --- | --- |
| READMEが旧名・旧URL・Firebase・Firestore・外部API・旧環境変数を現行として案内 | MatchupLabの機能とローカル保存、現行開発手順、公開先未確認を記載 |
| 現行要件・設計へのREADMEリンクなし | 要件・設計・画面・実装状況・現行配備手順を案内 |
| 非表示化・再表示、deactivate APIを記載 | 確認後の完全削除、inactiveはJSON互換用、再表示なしを記載 |
| 実在しないrepositoryファイル・API型 | 現行ディレクトリと関数シグネチャへ修正 |
| 復元の件数・ID集合確認を同じtransaction内で保証 | 書き込み後の別transactionで件数のみ確認する実装と失敗範囲を記載 |
| 非同期生成のrequest token、更新中の状態保護を実装済みのように説明 | 同期生成、更新による再読み込み、未実装の保護を区別 |
| PDF・JSONファイル名に日時、PWAキャッシュ名にビルドversion | PDFは条件名、JSONはUTC日付のみ、キャッシュ方針は手動v3を記載 |
| STEP2を未着手と記載し、画面案を現行仕様として参照 | UI・ブランド実装と改善案・未検証事項を区別 |
| 認証付きナビゲーション資料に履歴表示なし | 旧資料であることと現行画面への参照を追加 |

旧Firebase・API・リリース資料と旧PDF画像は履歴として保持し、今回の再検証結果で過去の検証記録を上書きしない。

## 4. 未実装・残る検証事項

| 分類 | 現状と影響 |
| --- | --- |
| データ・競合 | 登録上限はUI側件数を使用。他タブへの自動通知はなく、複数タブ同時登録の99人保証は未実装 |
| データ・復元 | 書き込みtransaction内の失敗はrollback。完了後の件数確認・通知失敗は置換済みの場合がある。ID集合確認は未実装 |
| UI・競合 | 保存・復元等に共通busyガードはない。更新ボタンは保存状態を参照しない |
| PDF・復帰 | フォント取得に失敗すると失敗Promiseが残り、再試行だけでは回復しない。再読み込みが必要。第7章の対応結果に再現を記録 |
| 非機能・性能 | 生成は同期でメインスレッドを使用。最大条件のPC p95 3秒／スマートフォン5秒、処理中表示・応答性は未測定 |
| PWA・環境 | installのキャッシュ失敗はcatchされる。全静的チャンクの事前取得、オフライン準備完了表示、更新タイムアウトは未実装 |
| PWA・キャッシュ | ブランド画像は明示的静的キャッシュ対象外。ビルド単位のキャッシュ分離・旧資産削除はなく、混在・増加の検証が必要 |
| UI・アクセシビリティ | 全ダイアログのフォーカス管理、reduced-motion、全操作44px基準、戻る操作でのメニュー閉鎖は保証しない |
| 構造・残存設定 | AppClientShellは未分割。固定user・到達しない匿名分岐、旧npm package名、CI／E2EのFirebaseダミー設定が残る |
| 非機能・検証範囲 | モバイル実機、iOS Safari、Firefox／WebKit、更新中操作、容量制限・保存拒否・複数タブは今回未実施 |
| 運用 | 現行Vercel Project・公開URL・production動作は今回未確認。旧アプリURLを現行公開先として扱わない |

優先して防ぐべきものは保存・全置換復元の誤認とデータ消失、更新と保存の競合、未取得資産によるオフライン起動失敗である。これらを文書の修正で実装解決済みとはしない。後続で実装する際は、不足観点・データ・環境・実装のいずれに原因があるか再現手順と証跡で切り分ける。

## 5. 文書整合確認時の検証

| 検証 | 結果 | 意図・範囲 |
| --- | --- | --- |
| GitHub mainとローカルHEAD | 一致 | 同じ実装と文書を比較していることを確認 |
| 文書7ファイルの相対リンク・見出し参照 | 29リンク、欠落なし | GitHub上で文書・参照画像・現行節へ到達できる構造を確認 |
| Markdownコードフェンス・置換文字 | 問題なし | 編集による記法・文字化けの混入を確認 |
| `git diff --check` | 成功 | 差分の空白エラーを確認 |
| 既存Vitestの対象7ファイル | 37テスト成功 | 登録・更新・完全削除、購読、全置換・空復元・失敗時保持、JSON、形式別条件、生成・候補評価、PDFモデル、Guestを確認 |

単体の対象は `memberRepository.test.ts`、`memberJson.test.ts`、`buildMatchConditions.test.ts`、`generateMatchupUseCase.test.ts`、`generateMatchup.test.ts`、`buildPdfDocumentModel.test.ts`、`buildGuestParticipants.test.ts`。実行は `npm test --` にこれら7ファイルを指定した。既存Vitest設定について将来のVite native config loaderとの互換性警告が出たが、終了コードは0だった。

対象外の単体テスト、lint、型チェック、本番ビルド、npm auditは今回再実行していない。文書変更のみのため、新規テストは追加していない。

E2Eは未実施を選択する。変更が文書のみで画面・データ・アルゴリズムに変更がないため。Chromium／Firefox／WebKit、実機、オフライン操作、デプロイ確認は今回の実行範囲に含めない。

## 6. CIへのnpm audit追加（2026-10-06）

以下は依存更新前の追加時点の記録。現在の監査方式と検証結果は第7章・対応結果を参照する。

`tennis-organizing-app` のGitHub main `1b17dda5d6538edc0d1f07031ea4cde830b2231f` とローカルHEADの一致を確認し、監査ステップ・終了判定・artifact保存を参照した。MatchupLabでは開発用依存も含むLow以上を失敗条件とし、参照先固有の期限付き例外やFirebase検証は導入しない。

テスト観点は、機能（監査の実行順・対象）、非機能（通信失敗・終了判定）、データ（JSONレポート保存）、UI（Actionsログ・artifactからの確認）に分けた。正常系は終了0、異常系は脆弱性検出・監査失敗の非ゼロ、境界はLowの閾値とdev依存の包含、状態遷移は失敗後のartifact保存と後続build停止を確認対象にした。

- 現在のlockfileに `npm audit --json` とCIと同じ `npm audit --include=dev --audit-level=low --json` を実行し、いずれも14件（Critical 1、High 9、Moderate 3、Low 1）、終了コード1を確認した。最優先の検出はNext.jsのCriticalで、依存更新は今回実施していない。
- CIの監査はbuild前で失敗を維持するため、現行依存のままならCIは監査で失敗する。
- YAML構文、監査の位置・dev包含・閾値・artifact設定、`git diff --check` は成功した。監査コマンドだけを終了0／1／2のスタブへ置き換え、Git BashでActionsと同じ `-eo pipefail` のパイプを実行した。いずれもJSONがteeへ渡り、npmの終了コードがそのまま保持された。通信障害そのものやartifactアップロードの実サービス確認ではない。
- E2Eは未実施。CI設定・文書だけの変更であり、アプリの挙動・依存関係は変更していない。GitHub Actions上での実行は未確認。

## 7. 承認された脆弱性対応（2026-10-06）

[対応案](./security-audit-response-plan.md) に沿ってNext.js・ESLint設定・Vitestと修正版の間接依存を更新し、上流未修正のbraces由来5件にだけ期限付きの開発依存例外を導入した。更新後は本番0件、全依存はHigh 5件で、Criticalは解消した。

監査の二重実行、lockfileとviaを確認する限定判定、期限切れ・通信失敗・不正な結果の失敗判定、判定テスト、Actions artifact保存を追加した。実際の版、検証件数、E2Eの選定理由と未実施範囲、残るリスクは [脆弱性対応結果](./security-audit-response-result.md) にまとめる。
