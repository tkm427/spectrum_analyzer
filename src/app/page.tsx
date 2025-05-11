"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { Toggle } from "@/components/ui/toggle";
import { getAudioAnalyzer } from "@/lib/audio";
import {
  SpectrumAnalyzer,
  VisualizationMode,
} from "@/components/analyzer/SpectrumAnalyzer";
import {
  AudioFileAnalyzer,
  getAudioFileProcessor,
} from "@/components/analyzer/AudioFileAnalyzer";

// 分析対象の種類
type AnalysisSource = "microphone" | "file";

export default function Home() {
  // テーマ（ダークモード）管理
  const { theme, setTheme } = useTheme();

  // 分析対象（マイク入力またはファイル）
  const [analysisSource, setAnalysisSource] =
    useState<AnalysisSource>("microphone");

  // 音声分析の状態
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表示設定
  const [visualizationMode, setVisualizationMode] =
    useState<VisualizationMode>("spectrum");
  const [isDarkMode, setIsDarkMode] = useState(false);

  // スペクトルデータ
  const [, setSpectrumData] = useState<number[]>(Array(64).fill(0));

  // オーディオファイルデータが準備完了かどうか
  const [, setIsFileDataReady] = useState(false);

  // アニメーションフレームのID
  const requestRef = useRef<number | null>(null);

  // テーマの初期状態をセット
  useEffect(() => {
    setIsDarkMode(theme === "dark");
  }, [theme]);

  // ダークモード切り替え
  const toggleDarkMode = (checked: boolean) => {
    setIsDarkMode(checked);
    setTheme(checked ? "dark" : "light");
  };

  // 音声分析の初期化
  const initializeAnalyzer = async () => {
    try {
      const analyzer = getAudioAnalyzer();
      const success = await analyzer.initialize();

      if (success) {
        setIsInitialized(true);
        setError(null);
      } else {
        setError("音声分析の初期化に失敗しました");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "不明なエラーが発生しました"
      );
    }
  };

  // 音声分析の開始/停止
  const toggleAnalysis = () => {
    const analyzer = getAudioAnalyzer();

    if (isAnalyzing) {
      analyzer.stop();
      setIsAnalyzing(false);

      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    } else {
      const success = analyzer.start();
      if (success) {
        setIsAnalyzing(true);

        // アニメーションの開始
        if (!requestRef.current) {
          const animate = () => {
            const newData = analyzer.getNormalizedSpectrum(64);
            setSpectrumData(newData);
            requestRef.current = requestAnimationFrame(animate);
          };
          requestRef.current = requestAnimationFrame(animate);
        }
      } else {
        setError(
          "音声分析の開始に失敗しました。マイクへのアクセスを確認してください。"
        );
      }
    }
  };

  // マイク・ファイル切り替え時の処理
  useEffect(() => {
    // マイクからファイルに切り替えるとき
    if (analysisSource === "file") {
      const analyzer = getAudioAnalyzer();
      analyzer.stop();
      setIsAnalyzing(false);

      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    }
  }, [analysisSource]);

  // ファイルデータ準備完了時の処理
  const handleFileDataReady = () => {
    setIsFileDataReady(true);

    // ファイルからスペクトルデータを取得するアニメーションを開始
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }

    const fileProcessor = getAudioFileProcessor();
    const animate = () => {
      if (fileProcessor.getPlayingStatus()) {
        const newData = fileProcessor.getNormalizedSpectrum(64);
        setSpectrumData(newData);
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }

      const analyzer = getAudioAnalyzer();
      analyzer.dispose();
    };
  }, []);

  return (
    <div className="w-full max-w-[1200px] mx-auto py-4 px-3 sm:py-6 sm:px-4 md:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          >
            <path d="M2 10v3"></path>
            <path d="M6 6v11"></path>
            <path d="M10 3v18"></path>
            <path d="M14 8v7"></path>
            <path d="M18 5v13"></path>
            <path d="M22 10v3"></path>
          </svg>
          周波数アナライザー
        </h1>

        {/* 右上のダークモード切替ボタン */}
        <button
          onClick={() => toggleDarkMode(!isDarkMode)}
          className="p-2 rounded-full bg-secondary/50 hover:bg-secondary/80 transition-colors"
          title={
            isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"
          }
        >
          {isDarkMode ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M12 2v2"></path>
              <path d="M12 20v2"></path>
              <path d="m4.93 4.93 1.41 1.41"></path>
              <path d="m17.66 17.66 1.41 1.41"></path>
              <path d="M2 12h2"></path>
              <path d="M20 12h2"></path>
              <path d="m6.34 17.66-1.41 1.41"></path>
              <path d="m19.07 4.93-1.41 1.41"></path>
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3a6.364 6.364 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
            </svg>
          )}
        </button>
      </div>

      {error && (
        <div
          className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md mb-4 flex items-center gap-2"
          role="alert"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" x2="12" y1="8" y2="12"></line>
            <line x1="12" x2="12.01" y1="16" y2="16"></line>
          </svg>
          <p className="font-medium text-sm">エラー: {error}</p>
        </div>
      )}

      {/* 入力ソース切り替え */}
      <Card className="mb-4">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4m0 0c-2.8 0-5 2.2-5 5v9a2 2 0 0 0 4 0v-7a3 3 0 0 1 6 0v7a2 2 0 0 0 4 0v-9c0-2.8-2.2-5-5-5Z"></path>
            </svg>
            入力ソース
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            分析に使用する音声ソースを選択してください
          </CardDescription>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Toggle
              pressed={analysisSource === "microphone"}
              onPressedChange={() => setAnalysisSource("microphone")}
              variant="outline"
              className="border-2 h-16 px-4 w-full flex items-center justify-center gap-3 data-[state=on]:bg-primary/10 data-[state=on]:border-primary/50 transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4m0 0c-2.8 0-5 2.2-5 5v9a2 2 0 0 0 4 0v-7a3 3 0 0 1 6 0v7a2 2 0 0 0 4 0v-9c0-2.8-2.2-5-5-5Z"></path>
              </svg>
              <span className="text-base font-medium">マイク</span>
            </Toggle>
            <Toggle
              pressed={analysisSource === "file"}
              onPressedChange={() => setAnalysisSource("file")}
              variant="outline"
              className="border-2 h-16 px-4 w-full flex items-center justify-center gap-3 data-[state=on]:bg-primary/10 data-[state=on]:border-primary/50 transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 18V6H8a6 6 0 0 0 0 12h10Z"></path>
                <circle cx="10" cy="12" r="1"></circle>
              </svg>
              <span className="text-base font-medium">ファイル</span>
            </Toggle>
          </div>
        </CardContent>
      </Card>

      {/* マイク入力の場合 */}
      {analysisSource === "microphone" && (
        <div className="grid grid-cols-1 gap-4 mb-4">
          {/* マイク制御 */}
          <Card className="border border-muted">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 18.5a8 8 0 0 0 8 0"></path>
                  <path d="M12 22.5v-4"></path>
                  <path d="M12 18.5a6 6 0 0 0 6-6v-6a6 6 0 0 0-12 0v6a6 6 0 0 0 6 6Z"></path>
                </svg>
                マイク制御
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                マイクに接続して音声分析を開始します
              </CardDescription>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={initializeAnalyzer}
                  disabled={isInitialized}
                  variant={isInitialized ? "outline" : "default"}
                  className="btn-primary h-14 text-sm sm:text-base"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <path d="M22 2v20h-7"></path>
                    <path d="M8 2v10"></path>
                    <path d="M2 12h12"></path>
                    <path d="m7 9 3 3-3 3"></path>
                  </svg>
                  {isInitialized ? "接続済み" : "マイク接続"}
                </Button>

                <Button
                  onClick={toggleAnalysis}
                  disabled={!isInitialized}
                  className={`h-14 text-sm sm:text-base ${
                    isAnalyzing
                      ? theme === "light"
                        ? "bg-white text-black border border-black hover:bg-gray-100 font-medium"
                        : "bg-black text-white border border-white hover:bg-gray-800 font-medium"
                      : theme === "light"
                      ? "bg-black text-white hover:bg-gray-800"
                      : "bg-white text-black hover:bg-gray-200"
                  }`}
                >
                  {isAnalyzing ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <rect width="4" height="16" x="6" y="4"></rect>
                      <rect width="4" height="16" x="14" y="4"></rect>
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                  {isAnalyzing ? "分析停止" : "分析開始"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 表示モード */}
          <Card className="border border-muted">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                  <path d="M3 9h18"></path>
                  <path d="M3 15h18"></path>
                  <path d="M9 3v18"></path>
                  <path d="M15 3v18"></path>
                </svg>
                表示モード
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                周波数データの表示方法を選択します
              </CardDescription>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-2 gap-3">
                <Toggle
                  pressed={visualizationMode === "spectrum"}
                  onPressedChange={() => setVisualizationMode("spectrum")}
                  variant="outline"
                  className="border-2 h-16 px-4 flex items-center justify-center gap-3 data-[state=on]:bg-primary/10 data-[state=on]:border-primary/50 transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <path d="M2 12h2"></path>
                    <path d="M6 12h2"></path>
                    <path d="M10 12h2"></path>
                    <path d="M14 12h2"></path>
                    <path d="M18 12h4"></path>
                    <path d="M4 18V6"></path>
                    <path d="M8 18V6"></path>
                    <path d="M12 18v-4"></path>
                    <path d="M16 18v-8"></path>
                    <path d="M20 18v-6"></path>
                  </svg>
                  <span className="text-sm font-medium">スペクトラム</span>
                </Toggle>
                <Toggle
                  pressed={visualizationMode === "spectrogram"}
                  onPressedChange={() => setVisualizationMode("spectrogram")}
                  variant="outline"
                  className="border-2 h-16 px-4 flex items-center justify-center gap-3 data-[state=on]:bg-primary/10 data-[state=on]:border-primary/50 transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <path d="M3 3v18h18"></path>
                    <path d="m7 18-4 4"></path>
                    <path d="M7 3v12"></path>
                    <path d="M12 3v18"></path>
                    <path d="M17 3v6"></path>
                    <path d="M17 15v6"></path>
                  </svg>
                  <span className="text-sm font-medium">スペクトログラム</span>
                </Toggle>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ファイル入力の場合 */}
      {analysisSource === "file" && (
        <>
          <AudioFileAnalyzer onDataReady={handleFileDataReady} />

          <div className="grid grid-cols-1 gap-4 mb-4">
            {/* 表示モード */}
            <Card className="border border-muted">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                    <path d="M3 9h18"></path>
                    <path d="M3 15h18"></path>
                    <path d="M9 3v18"></path>
                    <path d="M15 3v18"></path>
                  </svg>
                  表示モード
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  周波数データの表示方法を選択します
                </CardDescription>
              </CardHeader>
              <CardContent className="py-2">
                <div className="grid grid-cols-2 gap-3">
                  <Toggle
                    pressed={visualizationMode === "spectrum"}
                    onPressedChange={() => setVisualizationMode("spectrum")}
                    variant="outline"
                    className="border-2 h-16 px-4 flex items-center justify-center gap-3 data-[state=on]:bg-primary/10 data-[state=on]:border-primary/50 transition-all"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <path d="M2 12h2"></path>
                      <path d="M6 12h2"></path>
                      <path d="M10 12h2"></path>
                      <path d="M14 12h2"></path>
                      <path d="M18 12h4"></path>
                      <path d="M4 18V6"></path>
                      <path d="M8 18V6"></path>
                      <path d="M12 18v-4"></path>
                      <path d="M16 18v-8"></path>
                      <path d="M20 18v-6"></path>
                    </svg>
                    <span className="text-sm font-medium">スペクトラム</span>
                  </Toggle>
                  <Toggle
                    pressed={visualizationMode === "spectrogram"}
                    onPressedChange={() => setVisualizationMode("spectrogram")}
                    variant="outline"
                    className="border-2 h-16 px-4 flex items-center justify-center gap-3 data-[state=on]:bg-primary/10 data-[state=on]:border-primary/50 transition-all"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <path d="M3 3v18h18"></path>
                      <path d="m7 18-4 4"></path>
                      <path d="M7 3v12"></path>
                      <path d="M12 3v18"></path>
                      <path d="M17 3v6"></path>
                      <path d="M17 15v6"></path>
                    </svg>
                    <span className="text-sm font-medium">
                      スペクトログラム
                    </span>
                  </Toggle>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* スペクトル表示 */}
      {analysisSource === "microphone" ? (
        <SpectrumAnalyzer mode={visualizationMode} bands={64} />
      ) : (
        <Card className="border border-muted mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <path d="M20.4 14.5 16 10 4 20"></path>
              </svg>
              オーディオファイル周波数分析
            </CardTitle>
            <CardDescription>
              アップロードしたオーディオファイルの周波数解析結果
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 overflow-scroll">
            <div className="h-[400px]">
              <SpectrumAnalyzer mode={visualizationMode} bands={64} />
            </div>
          </CardContent>
        </Card>
      )}

      <footer className="mt-12 text-center text-muted-foreground py-4 border-t border-muted">
        <p className="flex items-center justify-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 8v4l3 3"></path>
          </svg>
          © 2025 周波数アナライザー
        </p>
      </footer>
    </div>
  );
}
