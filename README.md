# 学校図書館 蔵書鮮度診断

GitHub Pagesで動く静的サイトです。CSVは端末のブラウザ内で処理され、サーバーへ送信されません。

## 公開方法

ZIPを展開して、中のファイルをリポジトリのルートに置きます。GitHubの **Settings → Pages → Build and deployment → Deploy from a branch** で、公開するブランチと **/(root)** を選択してください。`index.html` が入口です。ZIPファイルそのものをリポジトリへ置くのではなく、展開したファイルを置きます。

## ファイル

- `index.html`：画面の入口
- `style.css`：診断画面と診断結果の印刷用スタイル
- `script.js`：CSV選択、画面表示、要点検一覧CSV出力
- `core.js`：CSV解析、分類・出版年集計、チェックシート用の並び替え
- `checklist.js`：蔵書チェックシートの表示と印刷ボタン
- `checklist.css`：チェックシートの画面・A4横向き印刷スタイル

外部ライブラリ、ビルド処理、APIキーは不要です。ソースコード内に蔵書データは含めていません。

JavaScriptのモジュールを使うため、ローカルの `file://` からの直接起動では動かないブラウザがあります。公開済みのGitHub Pagesで利用してください。
