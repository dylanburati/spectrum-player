<template>
  <div class="viz" ref="root">
    <svg :width="width" :height="height">
      <defs>
        <linearGradient
          v-for="(stops, i) in pathFills"
          :key="i"
          :id="`gradient${i}`"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop offset="0%" :stop-color="stops[0]" stop-opacity="1" />
          <stop offset="100%" :stop-color="stops[1]" stop-opacity="1" />
        </linearGradient>
      </defs>
      <path
        v-for="(d, i) in paths"
        :key="i"
        :fill="`url(#gradient${i})`"
        :d="d"
        stroke-width="0"
      />
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
import {
  cubicBezierCurves,
  line,
  absLines,
  reversePathComponents,
  toPath,
} from "../lib/curve";
import { buildList, flatMap } from "../lib/util";
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
    paths() {
      const firstX = this.settings.edgePadding * this.pointSeparation;
      const lastX =
        (this.settings.numBars - 1 + this.settings.edgePadding) *
        this.pointSeparation;
      const maxY = this.height * 0.9;
      const paths = [];
      let prevTop = [
        line(
          { x: firstX, y: maxY },
          { x: lastX, y: maxY },
          (d) => d.x,
          (d) => d.y
        ),
      ];
      for (let specIdx = this.spectrum.length - 1; specIdx >= 0; specIdx--) {
        const spec = this.spectrum[specIdx];
        const top = [];
        if (spec.length) {
          if (spec.length >= 2) {
            top.push(
              ...cubicBezierCurves(
                spec,
                (d) => (d.x + this.settings.edgePadding) * this.pointSeparation,
                (d) => d.y
              )
            );
          } else {
            top.push(
              line(
                { x: firstX, y: spec[0].y },
                { x: lastX, y: spec[0].y },
                (d) => d.x,
                (d) => d.y
              )
            );
          }
          const bottom = reversePathComponents(prevTop);
          paths.push(
            toPath([
              ...top,
              line(
                top[top.length - 1].end,
                bottom[0].start,
                (d) => d[0],
                (d) => d[1]
              ),
              ...bottom,
            ])
          );
          prevTop = top;
        }
      }
      if (!paths.length) {
        const { idleHeight } = this.settings;
        paths.push(
          toPath([
            ...absLines(
              [
                [firstX, maxY - idleHeight],
                [lastX, maxY - idleHeight],
                [lastX, maxY],
                [firstX, maxY],
              ],
              (d) => d[0],
              (d) => d[1]
            ),
          ])
        );
      }
      return paths;
    },
    pathFills() {
      const colorList = this.settings.colorList.slice();
      while (colorList.length < this.analysers.length) {
        colorList.push(colorList[colorList.length - 1].slice().reverse());
      }
      return colorList;
    },
    pointSeparation() {
      return (
        this.width / (this.settings.numBars - 1 + 2 * this.settings.edgePadding)
      );
    },
    barRects() {
      if (!this.isStopped) {
        return flatMap(this.spectrum, (e, i) => ({
          ...e,
          series: i,
        }));
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
      if (this.playState === "stopped") {
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
      const result = this.analysers.map(() => []);

      for (let i = 0; i < numBars; i++) {
        let lastY = this.height * 0.9;
        let powFloor = 0;
        let dbFloor = minDecibels;
        let idle = idleHeight;
        for (let specIdx = spectrumArr.length - 1; specIdx >= 0; specIdx--) {
          const curr = spectrumArr[specIdx][i];
          let h = idle;
          idle = 0;

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
          lastY -= h;
          result[specIdx].push({ x: i, y: lastY, h });
        }
      }
      this.spectrum = result;

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
      this.spectrum = [];
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
    this.analysers.forEach((el) => el.destroy());
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
