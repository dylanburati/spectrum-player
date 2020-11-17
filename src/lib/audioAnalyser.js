const { buildList } = require("./util");

class AudioAnalyser {
  weightsCache = new Map();

  constructor(id, context, file, options) {
    this.id = id;
    this.context = context;
    this.options = options;
    this.isCancelled = false;
    this.startTime = 0;
    this.lastOffset = 0;
    this.sourceState = 0;
    this.loadCallback = () => {};
    this.endCallback = () => {};

    this.context = new AudioContext();
    this.splitter = this.context.createChannelSplitter();
    this.splitter.connect(this.context.destination);
    this.replaceSource();

    const { fftSize, minDecibels, maxDecibels } = options;
    this.analyserL = this.context.createAnalyser();
    this.analyserL.fftSize = fftSize;
    this.analyserL.smoothingConstant = 0.5;
    this.analyserL.minDecibels = minDecibels;
    this.analyserL.maxDecibels = maxDecibels;
    this.splitter.connect(this.analyserL, 0, 0);
    this.analyserR = this.context.createAnalyser();
    this.analyserR.fftSize = fftSize;
    this.analyserR.smoothingConstant = 0.5;
    this.analyserR.minDecibels = minDecibels;
    this.analyserR.maxDecibels = maxDecibels;
    this.splitter.connect(this.analyserR, 1, 0);

    this.audioBufferL = new Float32Array(fftSize / 2);
    this.audioBufferR = new Float32Array(fftSize / 2);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      if (this.isCancelled) return;
      const buffer = await this.context.decodeAudioData(ev.target.result);
      this.source.buffer = buffer;
      if (!this.isCancelled && this.loadCallback) this.loadCallback();
    };
    reader.readAsArrayBuffer(file);
  }

  setOptions(next) {
    const prev = this.options;
    const analyserProps = [
      { get: (o) => o.fftSize, set: (o, v) => (o.fftSize = v) },
      { get: (o) => o.minDecibels, set: (o, v) => (o.minDecibels = v) },
      { get: (o) => o.maxDecibels, set: (o, v) => (o.maxDecibels = v) },
    ];
    analyserProps.forEach((prop) => {
      if (prop.get(next) !== prop.get(prev)) {
        prop.set(this.analyserL, prop.get(next));
        prop.set(this.analyserR, prop.get(next));
      }
    });
    this.options = next;
  }

  onLoad(listener) {
    this.loadCallback = listener;
    return this;
  }

  onEnded(listener) {
    this.endCallback = listener;
    return this;
  }

  startSource(when, offset) {
    if (this.sourceState === 1) return false;
    if (this.sourceState === 2) {
      this.replaceSource();
    }
    this.source.start(when, offset);
    this.sourceState = 1;
    return true;
  }

  stopSource(when) {
    if (this.sourceState === 0) return false;
    this.source.stop(when);
    this.sourceState = 2;
    return true;
  }

  play(when) {
    if (this.startSource(when, this.lastOffset)) {
      this.startTime = when || this.context.currentTime;
    }
  }

  pause() {
    if (this.stopSource()) {
      this.lastOffset += this.context.currentTime - this.startTime;
    }
  }

  stop() {
    if (this.stopSource()) {
      this.lastOffset = 0;
    }
  }

  replaceSource() {
    let buffer;
    if (this.source) {
      buffer = this.source.buffer;
      this.source.disconnect(this.splitter);
    }
    this.source = this.context.createBufferSource();
    this.source.connect(this.splitter);
    this.source.onended = () => {
      if (this.sourceState === 1 && this.endCallback) this.endCallback();
    };
    if (buffer) {
      this.source.buffer = buffer;
    }
  }

  destroy() {
    this.isCancelled = true;
    this.stopSource();
    this.splitter.disconnect();
  }

  getWeights() {
    const { numBars, minFreq, maxFreq, fftSize } = this.options;
    const key = [numBars, minFreq, maxFreq, fftSize].join("-");
    if (this.weightsCache.has(key)) {
      return this.weightsCache.get(key);
    }

    const freqs = buildList(
      numBars + 1,
      (i) =>
        minFreq * Math.exp(Math.sqrt(i / numBars) * Math.log(maxFreq / minFreq))
    );
    const weights = buildList(numBars, (i) => {
      const width = this.context.sampleRate / (fftSize / 2);
      const count = Math.min(16, Math.ceil((freqs[i + 1] - freqs[i]) / width));
      const start = Math.floor(freqs[i] / width);
      const arr = [];
      for (let i = 0; i < count && i + start < fftSize / 2; i++) {
        arr.push([i + start, 1.0 / count]);
      }
      return arr;
    });

    this.weightsCache.set(key, weights);
    return weights;
  }

  getSpectrum() {
    this.analyserL.getFloatFrequencyData(this.audioBufferL);
    this.analyserR.getFloatFrequencyData(this.audioBufferR);

    const weights = this.getWeights();
    return weights.map((weightArr) => {
      let binAverage = weightArr.reduce((x, [audioIndex, w]) => {
        return (
          x +
          (w * this.audioBufferL[audioIndex]) / 2 +
          (w * this.audioBufferR[audioIndex]) / 2
        );
      }, 0);
      return binAverage;
    });
  }

  getTimestamp() {
    return this.context.getOutputTimestamp().contextTime;
  }
}

export default AudioAnalyser;
