"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { getAudioAnalyzer } from "@/lib/audio";

// Chart.jsコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

// 表示モードの定義
export type VisualizationMode = "spectrum" | "spectrogram";

interface SpectrumAnalyzerProps {
  mode?: VisualizationMode;
  bands?: number;
}

/**
 * 周波数スペクトルアナライザーコンポーネント
 */
export function SpectrumAnalyzer({ mode = "spectrum" }: SpectrumAnalyzerProps) {
  // 最大周波数を固定 (20kHz)
  const maxFreq = 20000;

  // アニメーションフレームのIDを保持
  const requestRef = useRef<number | null>(null);

  // 固定の周波数ポイント - より詳細な周波数をカバーするように更新
  const frequencyPoints = [
    20, 30, 40, 50, 60, 75, 90, 110, 130, 160, 190, 220, 260, 300, 350, 400,
    450, 500, 550, 600, 650, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000,
    2500, 3000, 3500, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12000, 14000,
    16000, 20000,
  ];

  // 周波数ラベル
  const frequencyLabels = frequencyPoints.map(freq => {
    if (freq >= 1000) {
      return `${freq / 1000}k`;
    } else {
      return `${freq}`;
    }
  });

  // スペクトラムデータの状態（固定の周波数ポイントを使用）
  const [spectrumData, setSpectrumData] = useState<number[]>(
    Array(frequencyPoints.length).fill(0)
  );

  // 検出された基本周波数（ピッチ）
  const [pitch, setPitch] = useState<number>(0);

  // スペクトログラムの履歴データ
  const [spectrogramHistory, setSpectrogramHistory] = useState<number[][]>(
    Array(30).fill(Array(frequencyPoints.length).fill(0))
  );

  // テーマの状態を取得
  const { theme } = useTheme();

  // グラフ描画のアニメーション関数
  const animate = useCallback(() => {
    const analyzer = getAudioAnalyzer();
    const status = analyzer.getStatus();

    if (status.isInitialized && status.isActive) {
      const numRawDataBands = 20000; // getNormalizedSpectrum から取得するバンド数
      const rawData = analyzer.getNormalizedSpectrum(numRawDataBands);

      // 新しいアプローチ: 正確な周波数マッピング
      const newData = new Array(frequencyPoints.length).fill(0);

      // サンプリングレートを取得
      const sampleRate = 44100; // 標準的なオーディオのサンプリングレート
      const nyquist = sampleRate / 2;

      // 周波数ビンの幅を計算
      const binWidth = nyquist / numRawDataBands;

      for (let i = 0; i < frequencyPoints.length; i++) {
        const targetFreq = frequencyPoints[i];

        // より正確な周波数からインデックスへの変換
        // 低周波数でもより精度の高い表示が可能
        const index = Math.floor(targetFreq / binWidth);

        // インデックスが有効範囲内かチェック
        if (index >= 0 && index < numRawDataBands) {
          newData[i] = rawData[index];

          // 低周波数帯域でのデータ補間（より精密な表示のため）
          if (targetFreq < 2000) {
            // 前後のビンの値も使って平均化または最大値を取ることで表現を強化
            const prevIndex = Math.max(0, index - 1);
            const nextIndex = Math.min(numRawDataBands - 1, index + 1);

            // 周辺の値の最大値を使用して低周波数の表現を向上
            newData[i] = Math.max(
              newData[i],
              rawData[prevIndex] * 0.8,
              rawData[nextIndex] * 0.8
            );
          }
        } else {
          // フォールバック: 最も近い有効なインデックスを探す
          const closestIndex = Math.min(
            Math.max(0, index),
            numRawDataBands - 1
          );
          newData[i] = rawData[closestIndex] || 0;
        }
      }

      setSpectrumData(newData);

      // スペクトログラムの履歴を更新
      if (mode === "spectrogram") {
        setSpectrogramHistory(prev => {
          const newHistory = [...prev.slice(1), newData];
          return newHistory;
        });
      }

      // ピッチ検出
      const detectedPitch = analyzer.detectPitch();
      if (detectedPitch > 0) {
        setPitch(Math.round(detectedPitch));
      }
    }

    // 次のアニメーションフレームをリクエスト
    requestRef.current = requestAnimationFrame(animate);
  }, [mode, frequencyPoints, setSpectrumData, setSpectrogramHistory, setPitch]); // animate関数の依存関係

  // コンポーネントがマウントされた時にアニメーションを開始
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);

    // クリーンアップ関数
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [animate]); // animateが変更された時にエフェクトを再実行

  // スペクトラム表示用のデータ - 線グラフに変更
  const spectrumChartData = {
    labels: frequencyLabels,
    datasets: [
      {
        label: "周波数スペクトル",
        data: spectrumData,
        //backgroundColor: "transparent",
        borderColor:
          theme === "dark" ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.7)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
        fill: true,
        backgroundColor:
          theme === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)",
      },
    ],
  };

  // スペクトラム表示のオプション - リニアスケールに修正
  const spectrumOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0, // アニメーションを無効化（パフォーマンス向上のため）
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 255,
        title: {
          display: true,
          text: "振幅",
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.7)"
              : "rgba(0, 0, 0, 0.7)",
        },
        grid: {
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.6)"
              : "rgba(0, 0, 0, 0.6)",
        },
      },
      x: {
        type: "category", // リニアスケールのためカテゴリーに変更
        title: {
          display: true,
          text: "周波数 (Hz)",
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.7)"
              : "rgba(0, 0, 0, 0.7)",
        },
        grid: {
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.03)",
        },
        ticks: {
          autoSkip: true,
          maxRotation: 0,
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.6)"
              : "rgba(0, 0, 0, 0.6)",
          font: {
            size: 9,
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false, // 凡例を非表示
      },
      tooltip: {
        backgroundColor:
          theme === "dark" ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.7)",
        titleColor:
          theme === "dark"
            ? "rgba(255, 255, 255, 0.9)"
            : "rgba(255, 255, 255, 1)",
        bodyColor:
          theme === "dark"
            ? "rgba(255, 255, 255, 0.9)"
            : "rgba(255, 255, 255, 1)",
        padding: 8,
        bodyFont: {
          family: "system-ui, sans-serif",
          size: 12,
        },
        callbacks: {
          title: function (context) {
            const index = context[0].dataIndex;
            const freq = frequencyPoints[index];
            if (freq < 1000) {
              return `${freq}Hz`;
            }
            return `${freq / 1000}kHz`;
          },
        },
      },
    },
  };

  // スペクトログラム表示用のデータ
  const spectrogramData = {
    labels: Array(spectrogramHistory.length).fill(""),
    datasets: frequencyLabels.map((label, i) => {
      // モノトーン用のグラデーションを作成
      const intensity = 0.2 + (0.8 * i) / frequencyPoints.length;
      const color =
        theme === "dark"
          ? `rgba(255, 255, 255, ${intensity})`
          : `rgba(0, 0, 0, ${intensity})`;
      const bgColor =
        theme === "dark"
          ? `rgba(255, 255, 255, ${intensity * 0.5})`
          : `rgba(0, 0, 0, ${intensity * 0.5})`;
      return {
        label,
        data: spectrogramHistory.map(history => history[i]),
        borderColor: color,
        backgroundColor: bgColor,
        fill: false,
        pointRadius: 0,
        tension: 0.2,
        borderWidth: 1,
      };
    }),
  };

  // スペクトログラム表示のオプション
  const spectrogramOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0,
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 255,
        title: {
          display: true,
          text: "振幅",
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.7)"
              : "rgba(0, 0, 0, 0.7)",
        },
        grid: {
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.6)"
              : "rgba(0, 0, 0, 0.6)",
        },
      },
      x: {
        title: {
          display: true,
          text: "時間",
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.7)"
              : "rgba(0, 0, 0, 0.7)",
        },
        grid: {
          display: false,
        },
        ticks: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false,
      },
    },
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 py-3">
        <div>
          <CardTitle className="text-lg font-medium">
            {mode === "spectrum" ? "周波数スペクトル" : "スペクトログラム"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            リアルタイム音声周波数分析
          </CardDescription>
        </div>
        {pitch > 0 && (
          <div className="flex items-center bg-primary/10 text-primary rounded-md px-2 py-1">
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
              className="mr-1"
            >
              <path d="M12 18.5a6 6 0 0 0 6-6v-6a6 6 0 0 0-12 0v6a6 6 0 0 0 6 6Z"></path>
              <path d="M8 18.5a8 8 0 0 0 8 0"></path>
              <path d="M12 22.5v-4"></path>
              <path d="M22 8.5h-2a10 10 0 0 0-20 0H0"></path>
            </svg>
            <span className="font-medium text-sm">{pitch}Hz</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
          {mode === "spectrum" ? (
            <Line data={spectrumChartData} options={spectrumOptions} />
          ) : (
            <Line data={spectrogramData} options={spectrogramOptions} />
          )}
        </div>
        <div className="text-xs text-muted-foreground text-center mt-2">
          {mode === "spectrum"
            ? "※ グラフは20Hz～20kHzの周波数範囲を表示しています"
            : `※ グラフは${maxFreq}Hzまでの周波数データを時系列で表示しています`}
        </div>
      </CardContent>
    </Card>
  );
}
