<template>
  <div class="viz" ref="root">
    <svg
      :width="width"
      :height="height"
      :style="{ background: settings.backgroundColor }"
    >
      <defs v-html="defs" />
      <BarGroup
        v-if="settings.mode === 'Bars'"
        :x="settings.edgePadding * pointSeparation"
        :y="0"
        :height="0.9 * height"
        :pointSeparation="pointSeparation"
        :barWidth="pointSeparation * (1 - settings.barPadding)"
        :numPoints="settings.numBars"
        :idleHeight="settings.idleHeight"
        :colors="settings.colorList"
        :spectrum="spectrum"
        @set-defs="(html) => (defs = html)"
      />
      <AreaGroup
        v-if="settings.mode === 'Area'"
        :x="settings.edgePadding * pointSeparation"
        :y="0"
        :height="0.9 * height"
        :pointSeparation="pointSeparation"
        :numPoints="settings.numBars"
        :idleHeight="settings.idleHeight"
        :colors="settings.colorList"
        :spectrum="spectrum"
        @set-defs="(html) => (defs = html)"
      />
    </svg>
    <span
      class="indicator"
      :style="{ color: fgColor }"
      v-if="lastRenders.length"
    >
      FPS: {{ (1000 / lastRenders[lastRenders.length - 1].took).toFixed(2) }}
      <br />
      t = {{ lastRenders[lastRenders.length - 1].audioTimestamp.toFixed(4) }} s
    </span>
  </div>
</template>

<script>
import { parseRGB, rgbToHSL } from "../lib/colorConvert";
import AudioAnalyser from "../lib/audioAnalyser";
import { buildList } from "../lib/util";
import eventListenerMixin from "../mixins/eventListenerTracker";
import AreaGroup from "./AreaGroup.vue";
import BarGroup from "./BarGroup.vue";

export default {
  name: "Visualizer",
  props: {
    playState: String,
    files: Array,
    settings: Object,
  },
  components: {
    AreaGroup,
    BarGroup,
  },
  mixins: [eventListenerMixin],
  data: () => ({
    width: 10,
    height: 10,
    spectrum: [],
    loading: new Set(),
    idCounter: 0,
    context: new AudioContext(),
    analysers: [],
    lastRenders: [],
    audioStartTime: 0,
    defs: "",
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
    pointSeparation() {
      if (this.settings.mode === "Bars") {
        return (
          this.width /
          (this.settings.numBars -
            this.settings.barPadding +
            2 * this.settings.edgePadding)
        );
      }
      if (this.settings.mode === "Area") {
        return (
          this.width /
          (this.settings.numBars - 1 + 2 * this.settings.edgePadding)
        );
      }
      throw new Error("Unsupported mode " + this.settings.mode);
    },
    fgColor() {
      const [h, s, l] = rgbToHSL(parseRGB(this.settings.backgroundColor));
      // green is negative
      const cutoffAdj =
        (25 * s * (Math.abs(((h + 90) % 360) - 180) - 90)) / 9000;
      return l > 55 + cutoffAdj ? "#000" : "#FFF";
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
        let audioTimestamp = this.context.currentTime - this.audioStartTime;
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
  },
  watch: {
    files: {
      immediate: true,
      handler(val, _prev) {
        const prev = _prev || [];
        if (val.length === prev.length && val.every((e, i) => e === prev[i])) {
          return;
        }
        if (val.length && this.idCounter === 0) {
          this.context.resume();
        }
        this.$emit("readystatechange", false);
        this.resetIndicatorData();
        while (val.length < this.analysers.length) {
          const analyser = this.analysers.pop();
          analyser.destroy();
        }
        const changes = buildList(Math.max(prev.length, val.length), (i) => ({
          prevFile: i < prev.length ? prev[i] : null,
          file: i < val.length ? val[i] : null,
          analyser: i < this.analysers.length ? this.analysers[i] : null,
        }));
        while (changes.length < this.analysers.length) {
          const analyser = this.analysers.pop();
          analyser.destroy();
        }
        const nextAnalysers = changes.map(({ prevFile, file, analyser }) => {
          if (analyser && prevFile !== file) {
            analyser.destroy();
          }
          if (file && file !== prevFile) {
            const id = this.idCounter;
            this.idCounter++;

            const nxt = new AudioAnalyser(id, this.context, file, {
              ...this.settings,
            });

            this.loading.add(id);
            return nxt
              .onLoad(() => {
                this.loading.delete(id);
                if (this.loading.size === 0 && this.analysers.length) {
                  this.$emit("readystatechange", true);
                }
              })
              .onEnded(() => {
                this.$emit("finished");
              });
          }
          return analyser;
        });
        this.analysers = nextAnalysers.filter((e) => e !== null);
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
        this.audioStartTime = this.context.currentTime;
        this.analysers.forEach((el) => el.play());
        requestAnimationFrame((ts) => this.calculateBarHeights(ts));
      } else if (val === "paused") {
        this.analysers.forEach((el) => el.pause());
      } else if (val === "stopped") {
        if (prev !== "stopped") {
          console.log("stopping");
          this.analysers.forEach((el) => el.stop());
          this.resetIndicatorData();
        }
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
