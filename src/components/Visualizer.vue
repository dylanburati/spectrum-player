<template>
  <div class="viz" ref="root">
    <svg :width="width" :height="height">
      <g
        v-for="(h, i) in barHeights"
        :key="i"
        :fill="barColors[i]"
        :transform="`translate(${(i + settings.edgePadding) * barWidth},0)`"
        :width="barWidth"
      >
        <rect
          :y="height * 0.9 - Math.max(0, h)"
          :width="barWidth * (1 - settings.barPadding)"
          :height="Math.abs(h)"
        />
      </g>
    </svg>
    <button
      style="position: fixed; top: 92vh; right: 1rem"
      class="btn"
      @click="downloadSequence"
    >
      Save image sequence
    </button>
    <span
      style="position: fixed; top: calc(46px + 1rem); right: 1rem"
      v-if="isPlaying && svgs.length"
    >
      FPS: {{ (1000 / svgs[svgs.length - 1].took).toFixed(2) }}
    </span>
  </div>
</template>

<script>
import { rgbToHSL } from "../lib/colorConvert";

const buildList = (n, fn) => new Array(n).fill(0).map((_, i) => fn(i));
export default {
  name: "Visualizer",
  data: () => ({
    width: 10,
    height: 10,
    spectrum: [],
    audio: new Audio(),
    context: null,
    splitter: null,
    analyzerL: null,
    analyzerR: null,
    audioBufferL: null,
    audioBufferR: null,
    weightsCache: new Map(),
    svgs: [],
  }),
  props: {
    isPlaying: Boolean,
    isPaused: Boolean,
    file: Object,
    settings: Object,
  },
  computed: {
    barHeights() {
      if (this.isPlaying || this.isPaused) {
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
      return buildList(numBars, (i) => {
        const n = colorList.length;
        if (n === 1) return colorList[0];

        const progress = (i * (n - 1)) / numBars;
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
        return `hsl(${h}, ${s.toFixed(3)}%, ${l.toFixed(3)}%)`;
      });
    },
  },
  methods: {
    doResize() {
      this.width = this.$refs.root.clientWidth;
      this.height = this.$refs.root.clientHeight;
    },
    setAnalysers() {
      if (!this.context || !this.splitter) {
        return;
      }
      if (this.analyzerL && this.analyzerR) {
        this.splitter.disconnect(this.analyzerL);
        this.splitter.disconnect(this.analyzerR);
      }
      const { fftSize } = this.settings;
      this.analyserL = this.context.createAnalyser();
      this.analyserL.fftSize = fftSize;
      this.analyserL.smoothingConstant = 0.5;
      this.analyserR = this.context.createAnalyser();
      this.analyserR.fftSize = fftSize;
      this.analyserR.smoothingConstant = 0.5;
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
    snapshot() {
      const mk = (tag, props) => {
        const el = document.createElement(tag);
        const { children = [], ...attrs } = props;
        for (let k in attrs) el.setAttribute(k, String(attrs[k]));
        children.forEach((c) => el.appendChild(c));
        return el;
      };
      const svg = mk("svg", {
        width: this.width,
        height: this.height,
        children: this.barHeights.map((h, i) =>
          mk("g", {
            fill: this.barColors[i],
            transform: `translate(${
              (i + this.settings.edgePadding) * this.barWidth
            },0)`,
            width: this.barWidth,
            children: [
              mk("rect", {
                y: this.height * 0.9 - Math.max(0, h),
                width: this.barWidth * (1 - this.settings.barPadding),
                height: Math.abs(h),
              }),
            ],
          })
        ),
      });
      return svg.outerHTML;
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
        const frame = this.snapshot();
        const dt = this.svgs.length
          ? ts - this.svgs[this.svgs.length - 1].timestamp
          : 1000 / 60;
        this.svgs.push({
          index: this.svgs.length,
          timestamp: ts,
          took: dt,
          input: frame,
        });
        requestAnimationFrame((ts) => this.calculateBarHeights(ts));
      }
    },
    clearSvgs() {
      this.svgs.splice(0);
      // this.pngs.clear();
      // this.workerCounter += 1;
    },
    async stringifySequence(startIndex, endIndex) {
      if (!this.file || !this.svgs.length) {
        return [];
      }
      const end = endIndex !== undefined ? endIndex : this.svgs.length;
      const start = startIndex !== undefined ? startIndex : 0;

      const span = end - start;
      if (span > 1000) {
        const parts = await Promise.all(
          buildList(10, (i) =>
            this.stringifySequence(
              Math.floor(start + (i * span) / 10),
              Math.floor(start + ((i + 1) * span) / 10)
            )
          )
        );
        return parts.join("");
      }
      return this.svgs
        .slice(start, end)
        .map((svg) => svg.input.replace(/\n/g, "") + "\n")
        .join("");
    },
    async downloadSequence() {
      if (!this.file) {
        return;
      }
      const filename = `spectrum_${this.file.name}.txt`;
      let ldsvg = await this.stringifySequence();
      const blob = new Blob([ldsvg]);

      // make and click a temporary link to download the Blob
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      this.$refs.root.appendChild(link);
      link.click();
      link.remove();
    },
  },
  watch: {
    file(val) {
      this.$emit("readystatechange", false);
      this.clearSvgs();
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
    isPlaying(val) {
      if (val) {
        if (this.audio.currentTime === 0) {
          this.clearSvgs();
        }
        this.audio.play();
        requestAnimationFrame((ts) => this.calculateBarHeights(ts));
      }
    },
    isPaused(val) {
      if (val) {
        this.audio.pause();
      }
    },
    settings: {
      handler(next, prev) {
        if (next.fftSize !== prev.fftSize) {
          this.setAnalyzers();
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
      window.addEventListener("resize", this.doResize);
      this.doResize();
    });
  },
  unmounted() {
    if (this.audio) this.audio.src = null;
    window.removeEventListener("resize", this.doResize);
  },
};
</script>

<style>
.viz {
  overflow: hidden;
  height: calc(100vh - 47px);
}
</style>
