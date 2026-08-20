# MatchupLab 設計書

## 1. 文書情報と設計対象

本書は [要件定義書](./requirements.md) を実装へ落とし込むための設計書である。

画面構造、ナビゲーション、レスポンシブ境界、画面状態、画面受入基準は [画面設計書](./screen-design.md) に定義する。

MatchupLabは、`tennis-organizing-app` の基準コミットを土台に、Phase 1でFirebaseメンバーリポジトリと外部API proxyをIndexedDB・ローカル生成へ置き換えた状態である。本書はPhase 1の実装と、Phase 2以降の変更境界を定義する。

参照元は次のローカルリポジトリとコミットに固定する。

| 用途 | ローカルパス | コミット |
| --- | --- | --- |
| 画面・機能基盤 | `D:\work_codex\tennis-organizing-app` | `ed269664ec1f175e7c8619653171b70b38133e3a` |
| 組合せロジック | `D:\work_codex\tennis-matchup-app` | `024d75b5c1d314d7ea24d438ddcda8180c30f527` |
| UI・IndexedDB・PWA参考 | `D:\work_codex\draw-lab` | `2a360704603100ef2ff9d1df7093d78510b73401` |

Firebase上の既存データは存在しない前提とし、データ移行アダプターや移行画面は作成しない。

## 2. 目標アーキテクチャ

```text
┌──────────────────────────────────────────────┐
│ Next.js App Router / PWA                     │
│  route pages + AppClientShell                │
└───────────────────┬──────────────────────────┘
                    │ UI events / state
┌───────────────────▼──────────────────────────┐
│ Application layer                             │
│  member use cases                             │
│  matchup use case                             │
│  JSON import/export                            │
│  PDF export                                    │
└───────────────┬───────────────────┬──────────┘
                │                   │
┌───────────────▼──────────────┐ ┌──▼────────────────────────┐
│ Member repository adapter     │ │ Matchmaking domain          │
│ IndexedDB                     │ │ pure functions              │
│ no React / no Firebase        │ │ validation / scoring / seed │
└───────────────┬──────────────┘ └──────────────┬─────────────┘
                │                               │
         ┌──────▼──────┐                 ┌──────▼──────┐
         │ members DB  │                 │ MatchupResult│
         │ local only  │                 │ memory only  │
         └─────────────┘                 └─────────────┘
```

組合せ作成経路にNext.js API Route、Firebase SDK、外部ネットワークを含めない。PDFは既存の表示モデルを利用し、フォントやアイコンなどの静的アセットはPWAのキャッシュ対象とする。

## 3. ディレクトリ設計

```text
src/
  app/
    layout.tsx
    page.tsx
    members/page.tsx
    matchups/doubles/page.tsx
    matchups/singles/page.tsx
    AppClientShell.tsx
  features/
    members/
      model.ts
      memberRepository.ts
      indexedDbMemberRepository.ts
      memberJson.ts
      memberJson.test.ts
    matchmaking/
      application/
      domain/
      model/
      utils/
    matchups/
      formatParticipantDisplayName.ts
      pdf/
  hooks/
    useMatchupPdfExport.ts
  lib/
    storage/
    constants/
  components/
    pwa/
public/
  sw.js
```

### 3.1 レイヤー責務

| レイヤー | 責務 | 依存してよいもの | 依存してはいけないもの |
| --- | --- | --- | --- |
| `domain` | 休憩者選択、ペアリング、コート割当、スコア計算 | 型、seed付き乱数 | React、Next.js、Firebase、IndexedDB |
| `application` | 入力変換、候補seed評価、ユースケース | domain、model、zod | UI、HTTP、Firebase |
| `model` | 型、制約、JSON境界のスキーマ | zod（境界スキーマのみ） | React、Firebase |
| `members` repository | IndexedDB CRUD、全置換、エラー変換 | Web API | Firebase、コンポーネントの状態 |
| `app` / components | 入力、表示、画面状態、ナビゲーション | application、repository、hooks | 直接のIndexedDB操作、直接のdomain内部状態操作 |
| `pwa` | 静的アセットキャッシュ、更新通知 | Service Worker API | 個人データ、APIレスポンスの永続キャッシュ |

## 4. メンバー永続化設計

### 4.1 IndexedDB

```ts
const DATABASE_NAME = "matchup-lab";
const DATABASE_VERSION = 1;
const MEMBER_STORE_NAME = "members";
```

`members` object storeをkeyPath `id` で作成する。画面コンポーネントはIndexedDBを直接操作せず、リポジトリだけを呼び出す。

```ts
export type MemberRepository = {
  list(): Promise<Member[]>;
  add(input: MemberFormInput): Promise<Member>;
  update(id: string, input: MemberFormInput): Promise<Member>;
  deactivate(id: string): Promise<void>;
  replaceAll(members: Member[]): Promise<void>;
};
```

IDは `crypto.randomUUID()` を基本とし、日時はISO 8601 UTC文字列とする。`displayOrder` は登録順を表す整数とし、並び替えで連続値へ再採番してもよいが、IDを変更してはならない。

### 4.2 初期化とエラー

1. `indexedDB.open(DATABASE_NAME, DATABASE_VERSION)` を呼び出す。
2. `onupgradeneeded` でバージョンごとのマイグレーションを実行する。
3. DBオープン、request、transactionの各エラーをPromiseへ変換する。
4. `blocked` は他タブの旧接続が原因であることを表示する。
5. 保存失敗時はUIへ利用者向けエラーを返し、部分保存を成功扱いにしない。

将来のスキーマ変更では、既存storeを破壊せず、バージョン番号を増やした段階的マイグレーションを追加する。

### 4.3 全置換復元

JSON復元では、既存DBを先に消去しない。

1. ファイルをテキストとして読み込む。
2. JSON parse、スキーマ、バージョン、必須項目、型、ID重複を検証する。
3. 検証成功後に全置換確認ダイアログを表示する。
4. `readwrite` transaction内で `clear()` と全件 `put()` を実行する。
5. 件数とID集合を確認してtransactionを完了する。
6. abort/error時はtransactionの原子性により旧データを維持する。

## 5. JSON設計

### 5.1 形式

```ts
type MemberBackup = {
  schemaVersion: 1;
  appVersion: string;
  exportedAt: string;
  members: Member[];
};
```

JSONには組合せ結果、開催名、Guest、画面入力、PDF履歴を含めない。空の `members` は「0件への全置換」として有効な入力とする。

### 5.2 バリデーション結果

```ts
type ImportResult =
  | { state: "success"; members: Member[]; count: number }
  | { state: "error"; code: ImportErrorCode; message: string };

type ImportErrorCode =
  | "JSON_PARSE_ERROR"
  | "BACKUP_SCHEMA_UNSUPPORTED"
  | "BACKUP_REQUIRED_FIELD_INVALID"
  | "BACKUP_DUPLICATE_ID"
  | "BACKUP_MEMBER_INVALID";
```

エラーコードはテストとログの切り分けに使用し、画面には利用者が理解できる日本語メッセージを表示する。JSONファイルには個人情報が含まれる可能性があるため、選択前と復元完了後に注意書きを表示する。

## 6. 組合せロジック移植設計

### 6.1 移植対象

`tennis-matchup-app` の基準コミットから、次の純粋ロジックを移植する。

- `model/types.ts`
- `model/limits.ts`
- `model/schemas.ts`
- `application/buildMatchConditions.ts`
- `application/generateMatchupUseCase.ts`
- `domain/generateMatchup.ts`
- `domain/selectRestPlayers.ts`
- `domain/assignCourts.ts`
- `domain/calculateScore.ts`
- `domain/updateStats.ts`
- `utils/seededRandom.ts`
- 上記に対応する単体テストとfixture

PDF、API管理画面、API認証、Firebase Admin、共有URL、継続ラウンド生成は本フェーズの移植対象に含めない。

### 6.2 呼び出し境界

```ts
function generateMatchupUseCase(
  input: MatchConditionInput,
  seed: number,
): MatchupResult;
```

画面は入力状態を `MatchConditionInput` へ変換し、ブラウザ側でseedを生成してこのユースケースを呼び出す。結果は `MatchupResult` として画面状態に保持し、IndexedDBへ保存しない。

### 6.3 形式別ルール

| 項目 | ダブルス | シングルス |
| --- | --- | --- |
| 1面あたり | 4人 | 2人 |
| 最小参加者 | 4人 | 2人 |
| 対戦モード | 3種類 | `standard` 固定 |
| 性別評価 | モードに応じて使用 | 使用しない |
| 結果表示 | ペアA / ペアB | player1 vs player2 |

制約値は参加者2〜30人、コート1〜8面、実施回数1〜20回とする。参加者一覧の件数と `participantCount` は一致させる。

### 6.4 再現性

- 新規作成時に基準seedを生成する。
- 移植元の候補seed生成間隔、候補数、スコア比較順を変更しない。
- 同一入力、同一seed、同一ロジックバージョンで同一結果を得る。
- `generatedAt` は比較から除外する。
- fixtureでは条件、参加者順、seed、ラウンド、休憩者、コート割当、スコアを比較する。
- 移植元との完全一致が難しい場合は、差異を隠さず、出力正規化後の同等性とスコア制約の検証へ切り替える判断をADRに残す。

## 7. 画面状態設計

### 7.1 状態モデル

```text
loading
  ├─ storage-error
  └─ ready
       ├─ member-editing
       ├─ participant-selection
       ├─ import-validation
       │    ├─ import-error
       │    └─ import-confirmation → replacing → ready
       └─ matchup-ready
            ├─ court-reduction-confirmation
            ├─ generating
            │    ├─ result
            │    └─ generation-error → matchup-ready
            └─ result → generating（再作成）
```

オンライン／オフラインは上記に重なる環境状態として扱う。オフラインになっただけで入力や結果を破棄しない。Service Worker更新は、保存中・復元中・生成中に自動適用せず、利用者操作で適用する。

### 7.2 セッション状態

シングルスとダブルスの条件・選択・結果は別の状態領域へ保持する。同じセッションで画面遷移して戻った場合は状態を保持するが、ブラウザリロード時はメンバー以外を初期化する。

生成中は生成ボタン、再作成ボタン、条件変更による競合操作を無効化する。Promise完了後に現在の形式とrequest tokenを確認し、古い非同期結果が新しい結果を上書きしないようにする。

## 8. UI・ルーティング設計

### 8.1 ルート

| Route | 役割 |
| --- | --- |
| `/` | アプリ説明と各機能への導線 |
| `/members` | メンバー登録、編集、非表示、並び替え |
| `/matchups/doubles` | ダブルス条件入力、結果、PDF |
| `/matchups/singles` | シングルス条件入力、結果、PDF |

ルートページは薄いエントリポイントとし、画面ロジックはfeatureまたはAppClientShell配下へ集約する。将来の分割では、認証処理を削除した上で `AppClientShell` の責務をアプリシェル、メンバー画面、条件入力、結果表示、ナビゲーションへ分ける。

### 8.2 UI状態

すべての非同期操作に次の状態を設ける。

- 初期化中
- 入力可能
- 入力エラー
- 保存中
- 生成中
- 復元確認待ち
- 成功
- 失敗
- 無効化

状態は色、アイコン、テキスト、ARIA属性の組合せで伝える。disabled要素の説明が必要な場合は、無効化理由を近接テキストまたはtooltipで示す。

### 8.3 `draw-lab` 参照方針

`D:\work_codex\draw-lab` のローカル実装を参照し、次を再利用可能な設計知として取り込む。

- デスクトップとモバイルでのコンテンツ幅・余白の切り替え
- 224px級のサイド領域と、狭幅時の折りたたみ方針
- 6〜10px程度のカード・入力コントロールの角丸体系
- PWA状態、offline、update available、storage状態を分けた表示
- JSON復元結果をempty、success、errorで明確に分ける

色や寸法はMatchupLabの実画面で再調整し、既存アプリのブランド画像やテニス固定文言は持ち込まない。

## 9. PWA・オフライン設計

### 9.1 キャッシュ境界

キャッシュ対象はアプリシェル、Next.jsの静的JavaScript／CSSチャンク、マニフェスト、アイコン、ブランド画像、PDF生成に必要なフォントとする。メンバーデータ、JSONファイル、APIレスポンス、Firebase応答はキャッシュしない。

### 9.2 更新処理

1. キャッシュ名にアプリバージョンまたはビルドバージョンを含める。
2. 新Service Workerのinstall時に必要な静的資産を準備する。
3. activate時に旧バージョンの不要キャッシュを削除する。
4. 更新可能表示を出し、利用者が安全なタイミングで更新する。
5. 更新後に古いJavaScriptと新しいHTMLが混在しないことを確認する。

### 9.3 オフライン前提

初回アクセスにはネットワークが必要であり、一度も資産を取得していない端末はオフライン起動できない。オフラインでは「ネットワークがない」ことと「IndexedDBが利用できない」ことを別の状態として表示する。

## 10. PDF設計

既存の `buildPdfDocumentModel` と `exportMatchupPdf` を利用し、組合せ結果のドメイン型をPDF表示モデルへ変換する。PDF生成に必要なフォントをオンライン初回取得後に利用できるようにし、フォント取得失敗時は日本語が欠落したPDFを成功扱いにしない。

形式別表示は次のとおりとする。

- ダブルス：1コートにペアAとペアBを表示する。
- シングルス：1コートに `player1 vs player2` を表示する。
- 休憩者、ラウンド、開催名、MatchupLab名を表示する。
- PDFファイル名に形式と日時を含める。

## 11. エラー・セキュリティ設計

### 11.1 エラー境界

| 境界 | 内部エラー | UI表示 |
| --- | --- | --- |
| IndexedDB open/request/transaction | Error | この端末に保存できませんでした |
| JSON parse/schema | ImportErrorCode | JSONの形式を確認してください |
| 生成入力 | validation error | 参加者、コート数、実施回数を確認してください |
| 生成処理 | generation error | 組合せを作成できませんでした。条件を確認して再試行してください |
| PDFフォント・Blob | export error | PDFを作成できませんでした |
| Service Worker更新 | update error | 更新に失敗しました。現在のバージョンを継続します |

エラーの詳細を個人情報付きでconsole、URL、外部サービスへ送信しない。テストではエラーコードを使って原因切り分けを行う。

### 11.2 Firebase・API撤去

最終状態から次を削除する。

- `firebase` packageとFirebase Client SDK初期化
- `src/lib/firebase/client.ts`
- `memberRepository.ts` 内のFirestore実装
- `src/app/api/matchups/generate/route.ts` の外部API proxy
- Firebase環境変数、`firebase.json`、`.firebaserc`、`firestore.rules`
- `MATCHUP_API_BASE_URL`、`MATCHUP_API_KEY`
- 認証状態、認証画面、Firebaseエラー分岐

削除は、IndexedDBリポジトリとローカル生成のテストが通った後に行う。

## 12. テスト設計

### 12.1 単体・統合

- Member model：必須項目、trim、status、日時、ID生成
- IndexedDB repository：CRUD、再読み込み、空DB、transaction失敗、blocked、全置換
- JSON：正常、空、破損、未対応バージョン、重複ID、型不正、全置換失敗
- Matchmaking domain：形式、モード、seed再現性、休憩、公平性、コート、最大条件
- PDF：シングルス、ダブルス、未使用コート、休憩者、日本語フォント、Blob出力

### 12.2 E2E

E2Eは修正範囲に応じて選択する。ローカル保存変更時は、少なくとも次を直列で実行する。

1. IndexedDB初期化
2. メンバー登録
3. ページ再読み込み後のメンバー保持
4. 参加者・Guest・条件入力
5. 組合せ作成と結果表示
6. オフライン切断後の再作成、PDF、JSON
7. JSON全置換と既存データ維持確認

対象ブラウザ、viewport、ネットワーク、証跡（スクリーンショット、console、network、テストログ）を結果に記載する。認証・Firestore実データを前提とするテストは、Firebase撤去後は削除する。

## 13. フェーズ設計と実装順序

### 13.1 フェーズ構成

```text
Phase 0  基準版固定
   │  移植元・コミット・現行テストを固定
   ▼
Phase 1 / STEP1  ローカルファースト化
   │  ロジック移植 → IndexedDB → JSON → Firebase/API撤去 → PWA
   ▼
Phase 2 / STEP2  UI統一・競技表現の見直し
   │  UIトークン、文言、PDF、マニフェスト、ファイル名を統一
   ▼
Phase 3  リリース判定
      性能、実機、ブラウザ、オフライン、アクセシビリティ、回帰
```

### 13.2 フェーズごとの設計対象

| フェーズ | 状態 | 実装対象 | 変更してよい境界 | フェーズ完了時の状態 |
| --- | --- | --- | --- | --- |
| Phase 0 | 完了 | 基準コミット、依存関係、既存テスト | MatchupLabへの初期取り込み | 基準版を再現可能にビルド・テストできる |
| Phase 1 / STEP1 | 完了 | `features/matchmaking`、IndexedDB repository、JSON境界、Service Worker、PDFのローカル利用 | 認証・Firestore・外部APIを除くデータ経路と生成経路 | コア機能がローカル・オフラインで完結する |
| Phase 2 / STEP2 | 未着手 | `AppClientShell`分割、画面コンポーネント、CSS、manifest、PDF・JSON文言 | UI、表示文言、競技固定表現 | MatchupLabのUIと競技に依存しない表現になる |
| Phase 3 | 未着手 | E2E、実機、性能計測、Service Worker更新確認 | リリース判定用の検証環境と証跡 | 既知の未確認条件がなく、完了条件を判定できる |

### 13.3 フェーズ間の依存関係

- Phase 1のローカルデータモデルと生成ユースケースを確定するまで、Phase 2のUI文言や画面分割を最終確定しない。
- IndexedDB repositoryとJSON全置換のテストを通過したため、Firebase repositoryを削除済みである。
- ローカル生成の単体・ブラウザ確認を通過したため、外部API Routeを削除済みである。PDFのオフライン実機確認は残課題とする。
- Phase 1のService Worker境界が確定するまで、Phase 2のPWA名・アイコン・キャッシュ名を最終確定しない。
- Phase 3で基準端末・ブラウザ・ネットワーク条件を固定し、同一実機のテストを並列実行しない。

### 13.4 詳細実装順序

1. `ed269664…` の移植状態をタグまたはコミットで固定する。
2. `tennis-matchup-app` から純粋ロジックとテストを移植する。
3. IndexedDBリポジトリとJSON境界を実装する。
4. 基準版のFirestore購読をIndexedDB購読へ置き換える。
5. `/api/matchups/generate` をローカルuse case呼び出しへ置き換える。
6. 認証、Firebase、外部API依存を削除する。
7. Service Worker、PDF、JSONのオフライン動作を確認する。
8. UI、文言、マニフェスト、アイコン、ファイル名をMatchupLabへ統一する。
9. 単体、統合、E2E、PC、スマートフォン、性能、アクセシビリティを確認する。

各段階で、単体では成功し通しで失敗する状態依存、非同期競合、古いキャッシュ、データ復元失敗を再確認する。
