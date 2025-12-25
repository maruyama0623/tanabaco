# ソトバコ 棚卸しプロトタイプ

React + TypeScript + Vite + Tailwind + Zustand でスマホ/PC向け棚卸しワークフローを再現するプロトタイプです。  
SP_1 → SP_2 → SP_3 → SP_4 → SP_5 → PC_1 → PC_1(タブ切替) → PC_2 → PC_3 → PC_4 の順で体験できます。

## セットアップ
```bash
npm install
npm run dev
```

### ChatGPT連携AI検索
- `.env` などで `OPENAI_API_KEY`（必要に応じて `OPENAI_MODEL`、既定は `gpt-4o-mini`）をサーバー環境に設定してください。
- APIサーバーは `npm run server` で起動します。フロントの環境変数 `VITE_API_BASE` がデフォルトなら `http://localhost:4000/api` を参照します。
- 商品割当モーダルの「AI検索」タブで、写真とメモを送信して候補を取得できます。内部では `/api/ai-search` でChatGPTに商品マスタを渡し、上位5件を返します。

## 主な画面とルーティング
- `/start` (SP_1): 棚卸開始設定。棚卸日・事業部・担当者を入力しセッション開始。
- `/list` (SP_2/5): 撮影済み写真の3列グリッド。数量は右下表示。下部固定「写真を撮る」。
- `/camera` (SP_3): カメラ/ファイル入力で撮影。撮影後に数量入力へ遷移。
- `/count/:photoId` (SP_4): サムネ + 計算式 + 電卓型テンキー。確定/キャンセル。
- `/assign` (PC_1): 未割り当て/割り当て済みタブ。写真カードグリッド、数量編集、商品割り当て/変更、削除。
- `/assign/modal/:photoId` (PC_2): 商品割当モーダル。AI推薦(ダミー)、検索、簡易商品登録、選択確定。
- `/assigned` (PC_3): 割当済み単票ビュー。
- `/report` (PC_4): 棚卸表サマリー + テーブル + CSV出力ボタン。「棚卸完了する」はダミーアラート。

## 状態/データ
- Zustand 永続化 (localStorage):
  - `sessionStore`: 現在のInventorySession、PhotoRecord追加/数量更新/削除、商品割当、リセット。
  - `productStore`: 初期商品マスタ(5件)、検索、追加登録。
  - `masterStore`: 事業部・担当者・仕入先マスタの追加/削除。各入力の選択肢に使用。
- データモデル: Product / PhotoRecord / InventorySession を `src/types` に定義。
- 推薦: `mockRecommendProducts`（ダミーシャッフル）。`src/services/recommendationService.ts` で差し替え可能。
- 棚卸表集計: `buildReportRows` が PhotoRecord×Product JOIN で数量×単価を集計し、簡易前月データを生成。

## フォルダ構成（主要）
- `src/pages/sp/*`: スマホ向け画面 (開始/一覧/カメラ/数量入力)。
- `src/pages/pc/*`: PC向け画面 (割当一覧/モーダル/単票/棚卸表)。
- `src/components/common|mobile|desktop`: ボタン・タグ・ヘッダー・写真タイル・商品カード・テンキーなど。
- `src/store`: Zustandストア。
- `src/services`: 永続化・推薦・レポート・画像取り扱い。

## 使い方メモ
- 撮影はブラウザのファイルピッカー/captureを使用し、ObjectURLとして保持。
- 撮影キャンセルは数量入力画面で「キャンセルする」を押すと撮影分を削除。
- 商品割当モーダルで「商品登録をする」を開くと簡易登録→そのまま選択されます。
- CSVボタンでブラウザダウンロードされます。
