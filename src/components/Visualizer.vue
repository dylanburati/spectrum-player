<template>
  <div class="viz" ref="root">
    <svg :width="width" :height="height">
      <g
        v-for="(r, i) in barRects"
        :key="i"
        :fill="barColors[r.series][r.x]"
        :transform="`translate(${(
          (r.x + settings.edgePadding) *
          barWidth
        ).toFixed(3)},0)`"
        :width="barWidth"
      >
        <rect
          :y="r.y"
          :width="barWidth * (1 - settings.barPadding)"
          :height="r.h"
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
import { rgbToHSL, interpHSL } from "../lib/colorConvert";
import { buildList } from "../lib/util";
import AudioAnalyser from "../lib/audioAnalyser";
import eventListenerMixin from "../mixins/eventListenerTracker";

export default {
  name: "Visualizer",
  props: {
    playState: String,
    files: Array,
    settings: Object,
  },
  mixins: [eventListenerMixin],
  data: () => ({
    width: 10,
    height: 10,
    spectrum: [],
    loading: new Set(),
    idCounter: 0,
    analysers: [],
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
    barRects() {
      if (!this.isStopped) {
        return this.spectrum;
      }
      return buildList(this.settings.numBars, (i) => ({
        series: 0,
        x: i,
        y: 0.9 * this.height - this.settings.idleHeight,
        h: this.settings.idleHeight,
      }));
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
      const gradients = colorList.map((txtColors) => {
        const rgbList = txtColors.map((e) =>
          [e.substring(1, 3), e.substring(3, 5), e.substring(5)].map((s) =>
            parseInt(s, 16)
          )
        );
        const hslList = rgbList.map(rgbToHSL);
        const gradient = buildList(numBars - 1, (i) => {
          const n = txtColors.length;
          if (n === 1 || numBars === 1) return txtColors[0];

          const progress = (i * (n - 1)) / (numBars - 1);
          const leftIndex = Math.floor(progress);
          const pair = hslList.slice(leftIndex, leftIndex + 2);
          const alpha = progress % 1.0;
          const [h, s, l] = interpHSL(alpha, pair[0], pair[1]);
          return `hsl(${h.toFixed(2)}, ${s.toFixed(3)}%, ${l.toFixed(3)}%)`;
        });
        gradient.push(txtColors[txtColors.length - 1]);
        return gradient;
      });
      while (gradients.length < this.analysers.length) {
        gradients.push(gradients[gradients.length - 1].slice().reverse());
      }
      return gradients;
    },
  },
  methods: {
    calculateBarHeights(ts) {
      if (!this.analysers.length) {
        this.$emit("readystatechange", false);
        return;
      }
      const {
        gamma,
        idleHeight,
        minDecibels,
        maxDecibels,
        numBars,
      } = this.settings;
      const additionalHeight = 0.8 * this.height - idleHeight;
      const dbRange = maxDecibels - minDecibels;
      const spectrumArr = this.analysers.map((e) => e.getSpectrum());

      const rectArr = buildList(numBars, (i) => {
        const acc = [];
        let lastY = this.height * 0.9;
        let powFloor = 0;
        let dbFloor = minDecibels;
        spectrumArr.forEach((spec, specIdx) => {
          const idle = specIdx === 0 ? idleHeight : 0;
          const curr = spec[i];
          let h = idle;
          if (Number.isFinite(curr)) {
            const pow = Math.pow(10, curr / 20);
            const nextDbFloor = 20 * Math.log10(powFloor + pow);
            if (nextDbFloor > dbFloor) {
              const floorScaled = Math.pow(
                (dbFloor - minDecibels) / dbRange,
                gamma
              );
              const nextFloorScaled = Math.pow(
                (nextDbFloor - minDecibels) / dbRange,
                gamma
              );
              h += (nextFloorScaled - floorScaled) * additionalHeight;
              dbFloor = nextDbFloor;
            }
            powFloor += pow;
          }
          if (h > 0) {
            lastY -= h;
            acc.push({ series: specIdx, x: i, y: lastY, h });
          }
        });
        return acc;
      });
      this.spectrum = rectArr.reduce((acc, curr) => {
        acc.push(...curr);
        return acc;
      }, []);

      if (this.isPlaying) {
        const tail =
          this.lastRenders.length &&
          this.lastRenders[this.lastRenders.length - 1];
        const dt = tail ? ts - tail.timestamp : 1000 / 60;
        let audioTimestamp =
          this.analysers[0].getTimestamp() - this.audioStartTime;
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
    newAudioNode() {
      const audio = new Audio();
      audio.loop = false;
      audio.autoplay = false;
      audio.crossOrigin = "anonymous";
      return audio;
    },
  },
  watch: {
    files: {
      immediate: true,
      handler(val, _prev) {
        const prev = _prev || [];
        if (val.length === prev.length && val.every((e, i) => e === prev[i])) {
          return;
        }
        this.$emit("readystatechange", false);
        this.resetIndicatorData();
        while (val.length < this.analysers.length) {
          const analyser = this.analysers.pop();
          analyser.destroy();
        }
        while (val.length > this.analysers.length) {
          const audio = this.newAudioNode();
          const id = this.idCounter;
          this.idCounter++;

          audio.addEventListener("canplay", () => {
            this.loading.delete(id);
            if (this.loading.size === 0 && this.analysers.length) {
              this.$emit("readystatechange", true);
            }
          });
          audio.addEventListener("ended", () => {
            this.$emit("finished");
          });
          const analyser = new AudioAnalyser(id, audio, { ...this.settings });
          this.analysers.push(analyser);
        }
        val.forEach((file, i) => {
          const prevFile = i < prev.length ? prev[i] : null;
          if (file !== prevFile) {
            const analyser = this.analysers[i];
            const reader = new FileReader();
            reader.onload = (ev) => {
              analyser.setSource(ev.target.result);
            };
            this.loading.add(analyser.id);
            reader.readAsDataURL(file);
          }
        });
      },
    },
    playState(val, prev) {
      if (val === "playing") {
        if (prev === "stopped") {
          this.resetIndicatorData();
        }
        if (!this.analysers.length) {
          this.$emit("readystatechange", false);
          return;
        }
        this.audioStartTime = this.analysers[0].getTimestamp();
        this.analysers.forEach((el) => el.play());
        requestAnimationFrame((ts) => this.calculateBarHeights(ts));
      } else if (val === "paused") {
        this.analysers.forEach((el) => el.pause());
      } else if (val === "stopped") {
        this.analysers.forEach((el) => el.stop());
        this.resetIndicatorData();
      }
    },
    settings: {
      handler(next) {
        this.analysers.forEach((el) => el.setOptions(next));
      },
    },
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
