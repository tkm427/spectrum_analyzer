"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// オーディオファイル分析のためのカスタムクラス
class AudioFileProcessor {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private startTime = 0;
  private pauseTime = 0;
  private duration = 0;

  constructor() {
    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
  }

  async loadAudioFile(file: File): Promise<boolean> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.duration = this.audioBuffer.duration;

      // アナライザーノードを作成
      this.analyser = this.audioContext!.createAnalyser();
      this.analyser.fftSize = 2048;

      return true;
    } catch (error) {
      console.error("オーディオファイルの読み込みに失敗:", error);
      return false;
    }
  }

  play(): void {
    if (!this.audioBuffer || !this.audioContext || !this.analyser) return;

    // 既に再生中のソースがあれば停止
    this.stop();

    // 新しいソースを作成
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.audioBuffer;

    // ソースをアナライザーに接続
    this.source.connect(this.analyser);

    // アナライザーを出力に接続
    this.analyser.connect(this.audioContext.destination);

    // 一時停止状態から再開する場合
    const offset = this.pauseTime > 0 ? this.pauseTime : 0;

    // 再生開始
    this.source.start(0, offset);

    this.startTime = this.audioContext.currentTime - offset;
    this.isPlaying = true;
  }

  pause(): void {
    if (!this.isPlaying || !this.source || !this.audioContext) return;

    // 現在の再生位置を保存
    this.pauseTime = this.audioContext.currentTime - this.startTime;

    // 再生を停止
    this.source.stop();
    this.source = null;
    this.isPlaying = false;
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch (e) {
        // すでに停止している場合のエラーは無視
      }
      this.source.disconnect();
      this.source = null;
    }

    this.isPlaying = false;
    this.pauseTime = 0;
  }

  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  getTimeData(): Uint8Array | null {
    if (!this.analyser) return null;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  getCurrentTime(): number {
    if (!this.audioContext) return 0;

    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }

    return this.pauseTime;
  }

  getDuration(): number {
    return this.duration;
  }

  getPlayingStatus(): boolean {
    return this.isPlaying;
  }

  // AudioAnalyzerと同様のスペクトルデータ取得関数を提供
  getNormalizedSpectrum(bands = 64): number[] {
    if (!this.analyser || !this.audioContext) {
      return Array(bands).fill(0);
    }

    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    const sampleRate = this.audioContext.sampleRate;
    const maxFreq = 20000; // 最大周波数を20kHzに固定
    const fftSize = this.analyser.fftSize;
    const binFreq = sampleRate / fftSize;
    const maxBin = Math.min(Math.floor(maxFreq / binFreq), freqData.length);
    const result = Array(bands).fill(0);

    // 対数スケールでバンドを分配
    // 20Hzから20kHzの間で指定されたバンド数に分割
    for (let i = 0; i < maxBin; i++) {
      const freq = i * binFreq;

      // 20Hz未満の周波数は無視
      if (freq < 20) continue;

      // 対数スケールでバンドインデックスを計算（20Hzから20kHzの範囲で）
      const bandIndex = Math.min(
        Math.floor((bands * Math.log10(freq / 20)) / Math.log10(maxFreq / 20)),
        bands - 1
      );

      if (bandIndex >= 0) {
        // 各バンドの最大値を取得
        result[bandIndex] = Math.max(result[bandIndex], freqData[i]);
      }
    }

    return result;
  }

  dispose(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.audioBuffer = null;
  }
}

// シングルトンインスタンス
let fileProcessorInstance: AudioFileProcessor | null = null;

function getAudioFileProcessor(): AudioFileProcessor {
  if (!fileProcessorInstance) {
    fileProcessorInstance = new AudioFileProcessor();
  }
  return fileProcessorInstance;
}

interface AudioFileAnalyzerProps {
  onDataReady?: (processor: AudioFileProcessor) => void;
}

export function AudioFileAnalyzer({ onDataReady }: AudioFileAnalyzerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioProcessor = useRef<AudioFileProcessor>(getAudioFileProcessor());
  const animationFrameRef = useRef<number | null>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const selectedFile = event.target.files[0];

    // オーディオファイルの種類をチェック
    if (!selectedFile.type.startsWith("audio/")) {
      setError("オーディオファイルのみアップロードできます");
      return;
    }

    setFile(selectedFile);
    setError(null);
    setIsLoading(true);

    try {
      const success = await audioProcessor.current.loadAudioFile(selectedFile);
      if (success) {
        setIsLoading(false);
        if (onDataReady) {
          onDataReady(audioProcessor.current);
        }
      } else {
        setError("ファイルの読み込みに失敗しました");
        setIsLoading(false);
      }
    } catch (err) {
      setError("ファイル処理中にエラーが発生しました");
      setIsLoading(false);
      console.error(err);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      audioProcessor.current.pause();
      setIsPlaying(false);
    } else {
      audioProcessor.current.play();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioProcessor.current.stop();
    setIsPlaying(false);
    setProgress(0);
  };

  // 再生進捗の更新
  useEffect(() => {
    if (!isPlaying) return;

    const updateProgress = () => {
      const currentTime = audioProcessor.current.getCurrentTime();
      const duration = audioProcessor.current.getDuration();

      if (duration > 0) {
        setProgress((currentTime / duration) * 100);
      }

      // 再生が終了したかチェック
      if (currentTime >= duration) {
        setIsPlaying(false);
        setProgress(0);
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (fileProcessorInstance) {
        fileProcessorInstance.dispose();
        fileProcessorInstance = null;
      }
    };
  }, []);

  return (
    <Card className="mb-4 w-full">
      <CardHeader className="py-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
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
            <path d="M18 18V6H8a6 6 0 0 0 0 12h10Z"></path>
            <circle cx="10" cy="12" r="1"></circle>
          </svg>
          オーディオファイル分析
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          音声ファイルをアップロードして詳細な周波数分析を行います
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 py-2">
        <div className="file-upload border-2 border-dashed border-muted hover:border-primary rounded-md p-4 sm:p-6 text-center cursor-pointer transition-all hover:bg-accent">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="file-upload-input absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            id="audio-file-input"
          />
          <label
            htmlFor="audio-file-input"
            className="cursor-pointer flex flex-col items-center justify-center gap-1 sm:gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="m3 16 4 4 4-4"></path>
              <path d="M7 20V4"></path>
              <path d="M11 12h4"></path>
              <path d="M11 8h7"></path>
              <path d="M11 16h10"></path>
            </svg>
            <p className="text-sm sm:text-base font-medium">
              タップしてファイルを選択
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              MP3, WAV, OGG, FLAC
            </p>
          </label>
        </div>

        {error && (
          <div
            className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md"
            role="alert"
          >
            <p className="text-xs sm:text-sm font-medium flex items-center gap-2">
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
              {error}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-3 space-y-2">
            <p className="text-xs sm:text-sm text-muted-foreground">
              ファイルを解析中...
            </p>
            <Progress value={50} className="animate-pulse" />
          </div>
        )}

        {file && !isLoading && !error && (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-secondary/80 rounded-md px-3 py-2">
              <div className="flex items-center gap-2">
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
                  className="text-primary"
                >
                  <path d="M18 18V6H8a6 6 0 0 0 0 12h10Z"></path>
                  <circle cx="10" cy="12" r="1"></circle>
                </svg>
                <span className="text-xs sm:text-sm font-medium truncate max-w-[150px] sm:max-w-[250px]">
                  {file.name}
                </span>
              </div>
              <span className="text-xs bg-background px-2 py-1 rounded-full text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>

            <div className="waveform-container bg-muted/30 rounded-md h-24 sm:h-32 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground/30"
              >
                <path d="M2 10v3"></path>
                <path d="M6 6v11"></path>
                <path d="M10 3v18"></path>
                <path d="M14 8v7"></path>
                <path d="M18 5v13"></path>
                <path d="M22 10v3"></path>
              </svg>
            </div>

            <div className="space-y-1">
              <Progress value={progress} className="h-3 bg-primary/20" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <div>{formatTime(audioProcessor.current.getCurrentTime())}</div>
                <div>{formatTime(audioProcessor.current.getDuration())}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                onClick={handlePlayPause}
                className="btn-primary h-12 text-sm sm:text-base"
              >
                {isPlaying ? (
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
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                )}
                {isPlaying ? "一時停止" : "再生"}
              </Button>
              <Button
                variant="outline"
                onClick={handleStop}
                disabled={!isPlaying && progress === 0}
                className="btn-secondary h-12 text-sm sm:text-base"
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
                  <rect width="16" height="16" x="4" y="4"></rect>
                </svg>
                停止
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 時間を「mm:ss」形式でフォーマットする関数
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export { getAudioFileProcessor };
