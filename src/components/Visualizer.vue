<template>
  <div class="viz" ref="root">
    <svg :width="width" :height="height">
      <g
        v-for="(h, i) in barHeights"
        :key="i"
        :fill="barColors[i]"
        :transform="`translate(${(
          (i + settings.edgePadding) *
          barWidth
        ).toFixed(3)},0)`"
        :width="barWidth"
      >
        <rect
          :y="height * 0.9 - Math.max(0, h)"
          :width="barWidth * (1 - settings.barPadding)"
          :height="Math.abs(h)"
        />
      </g>
    </svg>
    <span class="indicator" v-if="lastRenders.length">
      FPS: {{ (1000 / lastRenders[lastRenders.length - 1].took).toFixed(2) }}
      <br />
      t = {{ lastRenders[lastRenders.length - 1].audioTimestamp.toFixed(4) }} s
    </span>
  </div>
</template>

<script>
import { rgbToHSL } from "../lib/colorConvert";
import eventListenerMixin from "../mixins/eventListenerTracker";

const buildList = (n, fn) => new Array(n).fill(0).map((_, i) => fn(i));
export default {
  name: "Visualizer",
  props: {
    playState: String,
    file: File,
    settings: Object,
  },
  mixins: [eventListenerMixin],
  data: () => ({
    width: 10,
    height: 10,
    spectrum: [],
    audio: new Audio(),
    context: null,
    splitter: null,
    analyserL: null,
    analyserR: null,
    audioBufferL: null,
    audioBufferR: null,
    weightsCache: new Map(),
    lastRenders: [],
    audioStartTime: 0,
  }),
  computed: {
    isPlaying() {
      return this.playState === "playing";
    },
    isPaused() {
      return this.playState === "paused";
    },
    isStopped() {
      return this.playState === "stopped";
    },
    barHeights() {
      if (!this.isStopped) {
        return this.spectrum;
      }
      return new Array(this.settings.numBars).fill(this.settings.idleHeight);
    },
    barWidth() {
      if (this.settings.barWidth === "fit") {
        return (
          this.width /
          (this.settings.numBars -
            this.settings.barPadding +
            2 * this.settings.edgePadding)
        );
      }
      return this.settings.barWidth;
    },
    barColors() {
      const { colorList, numBars } = this.settings;
      const rgbList = colorList.map((e) =>
        [e.substring(1, 3), e.substring(3, 5), e.substring(5)].map((s) =>
          parseInt(s, 16)
        )
      );
      const hslList = rgbList.map(rgbToHSL);
      const gradient = buildList(numBars - 1, (i) => {
        const n = colorList.length;
        if (n === 1 || numBars === 1) return colorList[0];

        const progress = (i * (n - 1)) / (numBars - 1);
        const leftIndex = Math.floor(progress);
        const pair = hslList.slice(leftIndex, leftIndex + 2);
        let hueDelta = pair[1][0] - pair[0][0];
        const altHueDelta =
          hueDelta > 0
            ? pair[1][0] - (pair[0][0] + 360)
            : pair[1][0] + 360 - pair[0][0];
        if (Math.abs(altHueDelta) < Math.abs(hueDelta)) {
          hueDelta = altHueDelta;
        }

        const alpha = progress % 1.0;
        const [s, l] = [1, 2].map(
          (j) => pair[0][j] * (1 - alpha) + pair[1][j] * alpha
        );
        const hue = pair[0][0] + alpha * hueDelta;
        const h = (hue + 360) % 360;
        return `hsl(${h.toFixed(2)}, ${s.toFixed(3)}%, ${l.toFixed(3)}%)`;
      });
      gradient.push(colorList[colorList.length - 1]);
      return gradient;
    },
  },
  methods: {
    setAnalysers() {
      if (!this.context || !this.splitter) {
        return;
      }
      if (this.analyserL && this.analyserR) {
        this.splitter.disconnect(this.analyserL);
        this.splitter.disconnect(this.analyserR);
      }
      const { fftSize, minDecibels, maxDecibels } = this.settings;
      this.analyserL = this.context.createAnalyser();
      this.analyserL.fftSize = fftSize;
      this.analyserL.smoothingConstant = 0.5;
      this.analyserL.minDecibels = minDecibels;
      this.analyserL.maxDecibels = maxDecibels;
      this.analyserR = this.context.createAnalyser();
      this.analyserR.fftSize = fftSize;
      this.analyserR.smoothingConstant = 0.5;
      this.analyserR.minDecibels = minDecibels;
      this.analyserR.maxDecibels = maxDecibels;
      this.splitter.connect(this.analyserL, 0, 0);
      this.splitter.connect(this.analyserR, 1, 0);

      this.audioBufferL = new Uint8Array(fftSize / 2);
      this.audioBufferR = new Uint8Array(fftSize / 2);
    },
    getWeights() {
      const { numBars, minFreq, maxFreq, fftSize } = this.settings;
      const key = [numBars, minFreq, maxFreq, fftSize].join("-");
      if (this.weightsCache.has(key)) {
        return this.weightsCache.get(key);
      }

      const freqs = buildList(
        numBars + 1,
        (i) =>
          minFreq *
          Math.exp(Math.sqrt(i / numBars) * Math.log(maxFreq / minFreq))
      );
      const weights = buildList(numBars, (i) => {
        const width = this.context.sampleRate / (fftSize / 2);
        const count = Math.min(5, Math.ceil((freqs[i + 1] - freqs[i]) / width));
        const start = Math.floor(freqs[i] / width);
        const arr = [];
        for (let i = 0; i < count && i + start < fftSize / 2; i++) {
          arr.push([i + start, 1.0 / count]);
        }
        return arr;
      });

      this.weightsCache.set(key, weights);
      return weights;
    },
    calculateBarHeights(ts) {
      if (!this.analyserL || !this.analyserR) {
        this.$emit("readystatechange", false);
        return;
      }
      const { idleHeight, gamma } = this.settings;
      const additionalHeight = 0.8 * this.height - idleHeight;
      this.analyserL.getByteFrequencyData(this.audioBufferL);
      this.analyserR.getByteFrequencyData(this.audioBufferR);

      const weights = this.getWeights();
      this.spectrum = weights.map((weightArr) => {
        let binAverage = weightArr.reduce((x, [audioIndex, w]) => {
          return (
            x +
            (w * this.audioBufferL[audioIndex]) / 2 +
            (w * this.audioBufferR[audioIndex]) / 2
          );
        }, 0);
        let scaled = Math.pow(binAverage / 255, gamma);
        return scaled * additionalHeight + idleHeight;
      });

      if (this.isPlaying) {
        const tail =
          this.lastRenders.length &&
          this.lastRenders[this.lastRenders.length - 1];
        const dt = tail ? ts - tail.timestamp : 1000 / 60;
        let audioTimestamp =
          this.context.getOutputTimestamp().contextTime - this.audioStartTime;
        if (tail && audioTimestamp < tail.audioTimestamp) {
          this.audioStartTime -= tail.audioTimestamp;
          audioTimestamp += tail.audioTimestamp;
        }
        this.lastRenders.push({
          timestamp: ts,
          audioTimestamp,
          took: dt,
        });
        if (this.lastRenders.length >= 36002) {
          this.lastRenders.splice(0, 36000);
        }
        requestAnimationFrame((ts) => this.calculateBarHeights(ts));
      }
    },
    resetIndicatorData() {
      this.lastRenders = [];
      this.spectrum.fill(this.settings.idleHeight);
    },
  },
  watch: {
    file(val) {
      this.$emit("readystatechange", false);
      this.resetIndicatorData();
      if (val && !this.context) {
        this.context = new AudioContext();
        this.splitter = this.context.createChannelSplitter();
        const source = this.context.createMediaElementSource(this.audio);
        source.connect(this.splitter);
        this.splitter.connect(this.context.destination);
        this.setAnalysers();
      }
      if (val) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          this.audio.src = ev.target.result;
          this.audio.load();
        };
        reader.readAsDataURL(val);
      }
    },
    playState(val, prev) {
      if (val === "playing") {
        if (prev === "stopped") {
          this.resetIndicatorData();
        }
        this.audioStartTime = this.context.getOutputTimestamp().contextTime;
        this.audio.play();
        requestAnimationFrame((ts) => this.calculateBarHeights(ts));
      } else {
        this.audio.pause();
        if (val === "stopped") {
          this.audio.currentTime = 0;
          this.resetIndicatorData();
        }
      }
    },
    settings: {
      handler(next, prev) {
        if (this.analyserL && this.analyserR) {
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
        }
      },
    },
  },
  created() {
    this.audio.loop = false;
    this.audio.autoplay = false;
    this.audio.crossOrigin = "anonymous";
    this.audio.addEventListener("canplay", () => {
      this.$emit("readystatechange", true);
    });
    this.audio.addEventListener("ended", () => {
      this.$emit("finished");
    });
  },
  mounted() {
    this.$nextTick(() => {
      const onResize = () => {
        this.width = this.$refs.root.clientWidth;
        this.height = this.$refs.root.clientHeight;
      };
      this.addEventListener({
        target: window,
        evtName: "resize",
        listener: onResize,
      });
      onResize();
    });
  },
  beforeUnmount() {
    if (this.audio) this.audio.src = null;
    this.removeAllEventListeners();
  },
};
</script>

<style>
.viz {
  overflow: hidden;
  height: calc(100vh - 47px);
}
.indicator {
  position: fixed;
  top: calc(46px + 1rem);
  right: 30px;
  text-align: right;
}
</style>
