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
  private fftSize = 4096;

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
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

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
    const fftSize = this.fftSize;
    const binFreq = sampleRate / fftSize; // 1ビンの周波数幅

    const result = Array(bands).fill(0);
    const minChartDisplayFreq = 20; // 表示上の最小周波数
    const maxChartDisplayFreq = 20000; // 表示上の最大周波数

    const logMin = Math.log10(minChartDisplayFreq);
    const logMax = Math.log10(maxChartDisplayFreq);
    const logRange = logMax - logMin;

    if (logRange <= 0) {
      // minChartDisplayFreq >= maxChartDisplayFreq の場合
      return result;
    }

    for (let k = 0; k < bands; k++) {
      // 各出力バンドについてループ
      // この対数スケールバンドの中心周波数を計算
      // バンドkは logRatio が k/bands から (k+1)/bands の範囲をカバーすると考える
      // その中心のlogRatioは (k + 0.5) / bands
      const bandLogRatioCenter = (k + 0.5) / bands;
      const centerFreqK = Math.pow(10, bandLogRatioCenter * logRange + logMin);

      // この中心周波数に最も近いFFTビンのインデックスを探す
      // FFTビンの周波数 fftBinFreq = j * binFreq なので、 j = centerFreqK / binFreq
      let closestBinIndex = Math.round(centerFreqK / binFreq);

      // FFTビンのインデックスを有効範囲 [0, freqData.length - 1] にクランプ
      // DCオフセット(インデックス0)を避けるため、最小を1とする場合もあるが、
      // AnalyserNodeのgetByteFrequencyDataは通常DCを含まないか、適切に処理されるため、
      // ここでは0から許容する（ただし、実際の音声信号では低周波はカットされることが多い）
      // より安全には、1から始める (Math.max(1, ...))
      closestBinIndex = Math.max(
        0,
        Math.min(closestBinIndex, freqData.length - 1)
      );

      if (closestBinIndex < freqData.length) {
        result[k] = freqData[closestBinIndex];
      } else {
        // このケースは上のクランプ処理により通常発生しない
        result[k] = 0;
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
