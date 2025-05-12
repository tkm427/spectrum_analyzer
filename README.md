# 周波数アナライザー | リアルタイム音声分析ツール

スマートフォンのマイクや音声ファイルを使用して、音の周波数をリアルタイムで計測・分析できるWebアプリケーションです。

## 概要

このアプリケーションは、Web Audio APIを活用して、マイク入力またはアップロードされた音声ファイルから周波数データを取得し、視覚的に表示します。主な機能として、スペクトラム表示とスペクトログラム表示の切り替え、ダークモード対応などがあります。

**デプロイ先:** [https://spectrum-analyzer-six.vercel.app/](https://spectrum-analyzer-six.vercel.app/) にアクセスしてアプリケーションを試すことができます。

## 主な機能

*   **リアルタイム音声分析**: マイク入力からリアルタイムで音声データを取得し、周波数スペクトルを表示します。
*   **音声ファイル分析**: アップロードされた音声ファイル（MP3, WAV, OGG, FLACなど）の周波数分析が可能です。
*   **多彩な視覚化**:
    *   **スペクトラム表示**: 現在の周波数成分の強度をグラフで表示します。
    *   **スペクトログラム表示**: 時間の経過と共に周波数成分の変化を色で表示します。

## Getting Started

開発を始めるための手順は以下の通りです。

### インストールと実行

1.  リポジトリをクローンします:
    ```bash
    git clone https://github.com/tkm427/spectrum_analyzer.git
    cd spectrum_analyzer
    ```
2.  依存関係をインストールします:
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    # or
    bun install
    ```
3.  開発サーバーを起動します:
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    # or
    bun dev
    ```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くと、アプリケーションが表示されます。
