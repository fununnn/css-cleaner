# CSS Cleaner - 実装ガイド

## プロジェクト概要

CSS Cleanerは、静的HTMLプロジェクトから未使用CSSを効率的に検出・削除するためのCLIツールです。ブラウザベースのUIで、セレクタの有効/無効を確認しながら安全にCSSをクリーンアップできます。

### 🎯 ツールの目的
- 静的HTMLプロジェクトに含まれる未使用CSSセレクタを効率的に検出し、削除・プレビュー・復元・保存できるようにする
- 未使用セレクタは100%の精度で検出できないことを前提に、「人が確認しながら試せるUI」を提供する
- 誤削除防止・作業効率化を両立したCLI + ブラウザ連携型ツールとして設計

## アーキテクチャ

### ファイル構成

```
css-cleaner/
├── package.json
├── cli.js          # CLIエントリーポイント
├── analyzer.js     # HTML/CSS解析エンジン
├── server.js       # Express APIサーバー
└── dist/
    └── index.html  # ブラウザUI（Vanilla JS）
```

### 推奨される追加ファイル

```
css-cleaner/
├── lib/
│   ├── file-scanner.js  # ファイル走査ロジック
│   ├── css-parser.js    # CSS解析専用モジュール
│   └── state-manager.js # セレクタ状態管理
├── dist/
│   ├── index.html
│   ├── app.js          # UIロジック
│   └── style.css       # UI用スタイル
└── config/
    └── defaults.js     # デフォルト設定
```

## 実装詳細

### 1. CLI（cli.js）

```javascript
#!/usr/bin/env node

// 主な機能：
// - コマンドライン引数の処理
// - プロジェクトルートの特定
// - HTML/CSSファイルの走査
// - Analyzerの呼び出し
// - Expressサーバーの起動
// - ブラウザの自動起動（オプション）

// 使用ライブラリ：
// - commander: CLI構築
// - globby: ファイル検索
// - open: ブラウザ起動
```

### 2. Analyzer（analyzer.js）

```javascript
// 主な機能：
// - HTMLファイルの解析
// - CSS参照の抽出
// - CSSセレクタの解析
// - 使用/未使用セレクタの判定
// - セレクタ状態オブジェクトの生成

// 使用ライブラリ：
// - cheerio: HTML解析
// - postcss: CSS解析
// - PurgeCSS: 未使用CSS検出（オプション）

// 主な使用ライブラリ候補：
// CLI構築: commander, yargs
// ファイル走査: globby, fs-extra
// HTML/CSSパース: cheerio, postcss
// 未使用CSS抽出: PurgeCSS, 独自ロジック
// サーバ: express
// UI構築: Vanilla JS, HTML, CSS
```

### 3. Server（server.js）

```javascript
// APIエンドポイント：
// GET  /api/selectors      - セレクタ一覧取得
// POST /api/toggle         - セレクタON/OFF切替
// POST /api/save           - cleaned.css保存
// POST /api/restore        - 状態復元
// GET  /api/preview/:file  - HTMLファイル提供
// GET  /api/css            - 動的CSS生成

// 使用ライブラリ：
// - express: Webサーバー
// - cors: CORS対応
```

### 4. UI（dist/index.html）

```html
<!-- 主な機能： -->
<!-- - セレクタ一覧の表示 -->
<!-- - チェックボックスによるON/OFF -->
<!-- - iframeでのプレビュー -->
<!-- - 保存/復元ボタン -->
<!-- - リアルタイム更新 -->

<!-- 技術スタック： -->
<!-- - Vanilla JavaScript -->
<!-- - Fetch API -->
<!-- - CSS Variables -->
<!-- - iframe操作 -->
```

## 処理フロー

### ステップ1：CLI起動
- 自動ファイル検出（HTML・CSS）
- 対象CSSをまとめて読み込み
- HTMLに登場するクラス・id・タグセレクタと照合
- PurgeCSSなどで未使用セレクタ候補を抽出（※100%正確でなくてもOK）

### ステップ2：未使用セレクタの構造化

```javascript
{
  ".btn-primary": { unused: false, active: true, css: "..." },
  ".debug-box": { unused: true, active: false, css: "..." },
  "#sidebar": { unused: true, active: false, css: "..." }
}
```

### ステップ3：ローカルサーバ起動（例： http://localhost:3456）

ブラウザUIを立ち上げて操作可能

## データ構造

### セレクタ状態オブジェクト

```javascript
{
  selectors: {
    ".btn-primary": {
      unused: false,      // 未使用判定
      active: true,       // 現在の有効状態
      css: "...",        // 元のCSSルール
      files: ["style.css"], // 定義元ファイル
      usedIn: ["index.html"] // 使用箇所
    }
  },
  stats: {
    total: 150,
    unused: 45,
    disabled: 20
  }
}
```

### セッション保存形式（session.json）

```json
{
  "timestamp": "2025-07-30T12:00:00Z",
  "projectRoot": "/path/to/project",
  "selectors": { /* 上記と同じ構造 */ },
  "files": {
    "html": ["index.html", "about.html"],
    "css": ["style.css", "components.css"]
  }
}
```

## 出力ファイル

- **cleaned.css**: ユーザーがONにしているセレクタのみで構成されたCSSファイル
- **session.json**: セレクタごとの状態（ON/OFF, unused判定）を保存
- **backup/**: 元のCSSファイルを自動バックアップ（任意）

## 実装時の注意点

### パフォーマンス考慮

1. **大規模プロジェクト対応**
   - ストリーミング処理でメモリ効率化
   - CSSファイルの分割読み込み
   - セレクタの遅延評価

2. **リアルタイム更新**
   - WebSocketの検討（大量セレクタ時）
   - デバウンス処理の実装
   - 差分更新でDOM操作最小化

### 対象ファイルの検出ルール

1. `npx css-cleaner` を実行したカレントディレクトリ以下を再帰的に走査
2. `.html` 拡張子ファイルをすべて取得
3. 各HTMLファイルから下記を抽出：
   - `<link rel="stylesheet" href="...">` → 相対パス解決 → CSSファイル読み込み
   - `<script src="...">` → 将来的にJS中のクラス付与も対応可（初期はスキップ）
4. 取得したCSSファイルをまとめて解析

### 想定プロジェクト構造（柔軟対応）

```
project-root/
├── index.html
├── pages/about.html
├── assets/css/style.css
├── assets/js/main.js
```

→ CSSやHTMLが深い階層にあっても対応可能。事前指定不要。

### エラーハンドリング

1. **ファイル走査**
   - シンボリックリンクの処理
   - 循環参照の検出
   - アクセス権限エラー

2. **CSS解析**
   - 不正なCSSシンタックス
   - @importの循環参照
   - メディアクエリの考慮

### セキュリティ

1. **パストラバーサル対策**
   - プロジェクトルート外へのアクセス制限
   - 相対パスの正規化

2. **XSS対策**
   - HTMLエスケープ
   - CSPヘッダーの設定

## テスト戦略

### ユニットテスト

```javascript
// test/analyzer.test.js
// - セレクタ抽出の精度
// - エッジケースの処理
// - パフォーマンス測定

// test/server.test.js
// - API応答の検証
// - 状態管理の整合性
```

### E2Eテスト

```javascript
// test/e2e/workflow.test.js
// - CLIからUIまでの一連の流れ
// - セレクタ切替の反映確認
// - 保存/復元の動作確認
```

## 拡張機能案

1. **JavaScript対応**
   - 動的クラス付与の検出
   - Reactコンポーネント解析

2. **CSS-in-JS対応**
   - styled-components検出
   - emotion検出

3. **レポート機能**
   - 削除前後の差分表示
   - ファイルサイズ削減率

4. **CI/CD連携**
   - GitHub Actions対応
   - 自動クリーンアップ

## 起動方法とUI詳細

### 🖥️ CLIからの起動

```bash
npx css-cleaner
```

- 任意のプロジェクトルートで1コマンドで実行可能
- HTML / CSS / JSの構造を自動解析し、UIで確認できるローカルWebサーバを起動（デフォルト: http://localhost:3456）

### 💻 UI設計詳細

#### 画面構成

```
┌────────────────────────────────────────────┐
│   ✅ 未使用候補一覧 + ON/OFFチェック       │
│                                            │
│   [x] .debug-box ❗                        │
│   [ ] .btn-primary                         │
│   [x] #sidebar ❗                          │
│                                            │
│   [全てON] [全てOFF] [復元] [保存]        │
└────────────────────────────────────────────┘
┌────────────────────────────────────────────┐
│   プレビュー（iframeでHTMLを読み込み）     │
└────────────────────────────────────────────┘
```

#### 操作機能

| 操作 | 内容 |
|------|------|
| ✅ 未使用候補の一覧表示 | 未使用っぽいセレクタに ❗マーク |
| 🔄 チェックボックスでON/OFF | セレクタ単位で即時ON/OFF反映 |
| 👀 iframeで表示 | 対象のHTMLページを表示し、CSS反映結果をすぐ確認 |
| ⏪ 元に戻す | セレクタ単体 or 全体復元 |
| 💾 保存する | cleaned.css に現在の有効セレクタのみ保存 |

- 変更があるたびにiframe内のCSSを差し替えて即反映
- セレクタの有効/無効の状態はクライアント側で保持（API経由で取得）

## コマンド例

```bash
# 基本実行
npx css-cleaner

# オプション付き
npx css-cleaner --port 4000 --no-open

# 特定ディレクトリ指定
npx css-cleaner ./src

# セッション復元
npx css-cleaner --restore session.json
```

## 開発時のヒント

1. **デバッグモード**
   - `DEBUG=css-cleaner:*` で詳細ログ出力
   - ブラウザのDevToolsでネットワーク監視

2. **ホットリロード**
   - nodemonでサーバー自動再起動
   - UIはブラウザリロードで対応

3. **パッケージ公開**
   - `npm link` でローカルテスト
   - semantic-versioningの遵守

## 機能まとめ

| 機能 | 実装されるか |
|------|-------------|
| CLIでディレクトリ走査 | ✅ |
| HTML内のCSS抽出 | ✅ |
| CSSファイル複数対応 | ✅ |
| 未使用CSSの候補抽出 | ✅ |
| ブラウザでUI確認 | ✅ |
| セレクタごとのON/OFF切替 | ✅ |
| 即時プレビュー反映 | ✅ |
| 復元ボタン | ✅ |
| 保存してcleaned.css出力 | ✅ |
| 誤削除防止の設計 | ✅ |