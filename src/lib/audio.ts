// Web Audio APIを使用した音声分析ユーティリティ

/**
 * 音声分析のためのクラス
 * Web Audio APIを使用して、マイク入力からリアルタイムで周波数データを解析します
 */
export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isInitialized = false;
  private isActive = false;

  // FFTサイズ（2の累乗である必要がある）
  private fftSize = 8192; // 8192はデフォルト値

  // 周波数データの配列
  private frequencyData: Uint8Array | null = null;
  // 時間領域データの配列
  private timeData: Uint8Array | null = null;

  /**
   * オーディオアナライザーを初期化する
   * マイクへのアクセス許可を求め、AudioContextとAnalyserNodeを設定
   */
  async initialize(): Promise<boolean> {
    try {
      // ブラウザのマイクへのアクセス許可を要求
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // AudioContextの作成
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) {
        console.error("AudioContext is not supported in this browser.");
        return false; // 初期化失敗
      }
      this.audioContext = new AudioContextClass();

      // オーディオソースの作成
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // アナライザーノードの作成と設定
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.8; // 0〜1の値。大きいほどスムージング効果が強くなる

      // ソースをアナライザーに接続
      this.source.connect(this.analyser);

      // 周波数データと時間領域データを格納する配列を作成
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("音声分析の初期化に失敗しました:", error);
      return false;
    }
  }

  /**
   * 音声分析を開始する
   */
  start(): boolean {
    if (!this.isInitialized) {
      console.error(
        "アナライザーが初期化されていません。まずinitialize()を呼び出してください。"
      );
      return false;
    }

    if (this.audioContext?.state === "suspended") {
      this.audioContext.resume();
    }

    this.isActive = true;
    return true;
  }

  /**
   * 音声分析を停止する
   */
  stop(): void {
    if (this.audioContext?.state === "running") {
      this.audioContext.suspend();
    }
    this.isActive = false;
  }

  /**
   * リソースを解放する
   */
  dispose(): void {
    if (this.source) {
      this.source.disconnect();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.analyser = null;
    this.source = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.frequencyData = null;
    this.timeData = null;

    this.isInitialized = false;
    this.isActive = false;
  }

  /**
   * 周波数データを取得する
   */
  getFrequencyData(): Uint8Array | null {
    if (
      !this.isInitialized ||
      !this.isActive ||
      !this.analyser ||
      !this.frequencyData
    ) {
      return null;
    }

    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  /**
   * 時間領域データを取得する
   */
  getTimeData(): Uint8Array | null {
    if (
      !this.isInitialized ||
      !this.isActive ||
      !this.analyser ||
      !this.timeData
    ) {
      return null;
    }

    this.analyser.getByteTimeDomainData(this.timeData);
    return this.timeData;
  }

  /**
   * 基本周波数（ピッチ）を検出する
   * @returns 検出された周波数（Hz）。検出できない場合は0
   */
  detectPitch(): number {
    const timeData = this.getTimeData();
    if (!timeData || !this.audioContext) {
      return 0;
    }

    // 自己相関関数を使用してピッチ検出
    const sampleRate = this.audioContext.sampleRate;
    const bufferLength = timeData.length;
    const correlations = new Float32Array(bufferLength);

    // 自己相関を計算
    for (let lag = 0; lag < bufferLength; lag++) {
      let correlation = 0;
      for (let i = 0; i < bufferLength - lag; i++) {
        correlation += (timeData[i] - 128) * (timeData[i + lag] - 128);
      }
      correlations[lag] = correlation;
    }

    // 相関関数のピークを見つける（最初のピークをスキップ）
    let maxCorrelation = -1;
    let maxLag = -1;

    // 最初のピークを見つける位置（低周波ノイズを避けるため）
    const minPeriod = sampleRate / 1000; // 1000 Hzを上限とする

    for (let lag = Math.floor(minPeriod); lag < bufferLength; lag++) {
      if (correlations[lag] > maxCorrelation) {
        maxCorrelation = correlations[lag];
        maxLag = lag;
      }
    }

    // ピークが検出されない場合は0を返す
    if (maxLag <= 0) {
      return 0;
    }

    // 周波数を計算（Hz）
    const fundamentalFreq = sampleRate / maxLag;
    return fundamentalFreq;
  }
  /**
   * 指定された周波数ポイントに対応するスペクトルデータを取得する
   * @param frequencyPoints 取得したい周波数ポイントの配列
   * @returns 各周波数ポイントに対応するスペクトルデータの配列
   */
  getCustomFrequencyData(frequencyPoints: number[]): number[] {
    const freqData = this.getFrequencyData();
    if (!freqData || !this.audioContext || freqData.length === 0) {
      return Array(frequencyPoints.length).fill(0);
    }

    const sampleRate = this.audioContext.sampleRate;
    const nyquist = sampleRate / 2; // ナイキスト周波数
    const binCount = freqData.length;
    const result = Array(frequencyPoints.length).fill(0);

    // 1つのFFTビンあたりの周波数幅
    const freqPerBin = nyquist / binCount;

    for (let i = 0; i < frequencyPoints.length; i++) {
      const targetFreq = frequencyPoints[i];

      // 周波数に対応するビンのインデックスを計算
      const exactBinIndex = targetFreq / freqPerBin;
      const lowerBinIndex = Math.floor(exactBinIndex);
      const upperBinIndex = Math.ceil(exactBinIndex);

      // バインの有効範囲をチェック
      if (lowerBinIndex >= 0 && upperBinIndex < binCount) {
        // 線形補間を使用して、より正確な値を計算
        const fraction = exactBinIndex - lowerBinIndex;
        const lowerValue = freqData[lowerBinIndex];
        const upperValue = freqData[upperBinIndex];

        // 線形補間
        result[i] = lowerValue * (1 - fraction) + upperValue * fraction;

        // 低周波数域での精度向上：周辺データの加重平均
        if (targetFreq < 1000) {
          // 隣接するビンも考慮して加重平均を計算
          let sum = result[i];
          let weight = 1;

          // 低周波数域では、より広い範囲のビンを考慮
          const range = Math.ceil(5 * (1 - targetFreq / 1000)); // 低周波ほど広い範囲を使用

          for (let j = 1; j <= range; j++) {
            const lIndex = Math.max(0, lowerBinIndex - j);
            const uIndex = Math.min(binCount - 1, upperBinIndex + j);

            // 距離に応じた重み付け（近いほど重み大）
            const w = (range - j + 1) / (range + 1);

            sum += freqData[lIndex] * w + freqData[uIndex] * w;
            weight += w * 2;
          }

          // 加重平均を計算
          result[i] = sum / weight;

          // 特に100Hz未満の超低周波数域ではさらに増幅
          if (targetFreq < 100) {
            const boost = 1.2 + (1 - targetFreq / 100) * 0.8; // 20Hzでは2.0倍、100Hzでは1.2倍
            result[i] = Math.min(255, result[i] * boost); // 255を超えないようにクリップ
          }
        }
      } else if (lowerBinIndex < 0) {
        // 下限を下回る場合は最初のビンの値を使用
        result[i] = freqData[0];
      } else {
        // 上限を超える場合は最後のビンの値を使用
        result[i] = freqData[binCount - 1];
      }
    }

    return result;
  }

  /**
   * オーディオスペクトルを正規化して取得する
   * @param bands 分割するバンド数
   * @returns 正規化されたスペクトルデータ
   */
  getNormalizedSpectrum(bands = 64): number[] {
    const freqData = this.getFrequencyData();
    if (!freqData || !this.audioContext || freqData.length === 0) {
      return Array(bands).fill(0);
    }

    const sampleRate = this.audioContext.sampleRate;
    const binCount = freqData.length;

    // 表示範囲の設定
    const minDisplayFreq = 20; // 表示上の最小周波数
    const maxDisplayFreq = 20000; // 表示上の最大周波数

    // 各バンドの周波数を均等に配置（リニアスケール）
    const result = Array(bands).fill(0);

    // 1サンプルあたりの周波数
    const freqPerBin = sampleRate / 2 / binCount;

    // 各バンドの周波数範囲を計算
    for (let i = 0; i < bands; i++) {
      // バンドの周波数を計算 (リニアスケール)
      const freqForBand =
        minDisplayFreq + (i / (bands - 1)) * (maxDisplayFreq - minDisplayFreq);

      // その周波数に対応するFFTビンのインデックスを計算
      const binIndex = Math.round(freqForBand / freqPerBin);

      // インデックスが有効範囲内かチェック
      if (binIndex >= 0 && binIndex < binCount) {
        result[i] = freqData[binIndex];
      }
    }

    return result;
  }

  /**
   * 現在のアナライザーの状態を取得する
   */
  getStatus(): { isInitialized: boolean; isActive: boolean } {
    return {
      isInitialized: this.isInitialized,
      isActive: this.isActive,
    };
  }

  /**
   * FFTサイズを変更する
   */
  setFFTSize(size: number): void {
    if (!this.analyser) return;

    // 2の累乗かチェック
    if (size & (size - 1)) {
      console.error("FFTサイズは2の累乗である必要があります");
      return;
    }

    this.fftSize = size;
    this.analyser.fftSize = size;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
  }
}

// シングルトンインスタンス
let instance: AudioAnalyzer | null = null;

/**
 * AudioAnalyzerのシングルトンインスタンスを取得
 */
export function getAudioAnalyzer(): AudioAnalyzer {
  if (!instance) {
    instance = new AudioAnalyzer();
  }
  return instance;
}
