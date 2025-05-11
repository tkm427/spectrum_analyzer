"use client";

import React, { useRef, useEffect, useState } from "react";
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
import { Bar, Line } from "react-chartjs-2";

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
export function SpectrumAnalyzer({
  mode = "spectrum",
  bands = 64,
}: SpectrumAnalyzerProps) {
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
  const animate = () => {
    const analyzer = getAudioAnalyzer();
    const status = analyzer.getStatus();

    if (status.isInitialized && status.isActive) {
      const numRawDataBands = 128; // getNormalizedSpectrum から取得するバンド数
      const rawData = analyzer.getNormalizedSpectrum(numRawDataBands);

      const newData = frequencyPoints.map(targetFreq => {
        if (rawData.length === 0) return 0;

        const minLogFreq = 20; // 対数スケールの最小周波数
        const maxLogFreq = 20000; // 対数スケールの最大周波数

        if (targetFreq < minLogFreq || targetFreq > maxLogFreq) {
          return 0; // ターゲット周波数が範囲外なら0
        }

        // 対数スケールに基づいたより正確なインデックス計算
        const minFreqLog = Math.log10(minLogFreq);
        const maxFreqLog = Math.log10(maxLogFreq);
        const targetFreqLog = Math.log10(targetFreq);
        const normalizedLogPosition =
          (targetFreqLog - minFreqLog) / (maxFreqLog - minFreqLog);

        // 0-1の範囲に収める
        const boundedPosition = Math.max(0, Math.min(normalizedLogPosition, 1));

        // より正確なインデックス計算
        let bandIndex = Math.floor(boundedPosition * (numRawDataBands - 1));

        // デバッグ用（必要に応じて）
        // console.log(`周波数: ${targetFreq}Hz, 位置: ${boundedPosition.toFixed(3)}, インデックス: ${bandIndex}`);

        return rawData[bandIndex] !== undefined ? rawData[bandIndex] : 0;
      });

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
      console.log("Raw data length:", rawData.length);
      console.log(
        "Frequencies over 900Hz:",
        frequencyPoints.filter(f => f > 900)
      );
      console.log("Sample data points:", newData.slice(24));
    }

    // 次のアニメーションフレームをリクエスト
    requestRef.current = requestAnimationFrame(animate);
  };

  // コンポーネントがマウントされた時にアニメーションを開始
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);

    // クリーンアップ関数
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [mode]); // modeが変更された時にエフェクトを再実行

  // スペクトラム表示用のデータ - 線グラフに変更
  const spectrumChartData = {
    labels: frequencyLabels,
    datasets: [
      {
        label: "周波数スペクトル",
        data: spectrumData,
        backgroundColor: "transparent",
        borderColor:
          theme === "dark" ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.7)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: {
          target: "origin",
          above:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.05)",
        },
      },
    ],
  };

  // スペクトラム表示のオプション - 対数スケールを使用
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
        type: "logarithmic",
        min: 20,
        max: maxFreq,
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
          maxRotation: 90,
          color:
            theme === "dark"
              ? "rgba(255, 255, 255, 0.6)"
              : "rgba(0, 0, 0, 0.6)",
          font: {
            size: 9,
          },
          callback: function (value) {
            const numericValue = Number(value);
            if (numericValue >= 1000) {
              return `${numericValue / 1000}k`;
            }
            return numericValue;
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
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
    labels: Array.from({ length: spectrogramHistory.length }).map((_, i) => ""),
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
            ? "※ グラフは20Hz～20kHzの対数スケールで表示しています"
            : `※ グラフは${maxFreq}Hzまでの周波数データを時系列で表示しています`}
        </div>
      </CardContent>
    </Card>
  );
}
