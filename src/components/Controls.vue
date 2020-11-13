<template>
  <div
    class="settings grid"
    ref="root"
    v-show="show"
    :style="{
      top: `${top}px`,
      left: `${left}px`,
    }"
  >
    <div>
      <label>Gamma</label>
      <input type="text" v-model="gamma" />
    </div>
    <div>
      <label>Number of Bars</label>
      <input type="text" v-model="numBars" />
    </div>
    <div>
      <label>Min Frequency</label>
      <input type="text" v-model="minFreq" />
    </div>
    <div>
      <label>Max Frequency</label>
      <input type="text" v-model="maxFreq" />
    </div>
    <div>
      <label>Min dB</label>
      <input type="text" v-model="minDecibels" />
    </div>
    <div>
      <label>Max dB</label>
      <input type="text" v-model="maxDecibels" />
    </div>
    <div>
      <label>In-Between Spacing (0&#x2011;1)</label>
      <input type="text" v-model="barPadding" />
    </div>
    <div>
      <label>Edge Spacing</label>
      <input type="text" v-model="edgePadding" />
    </div>
    <div>
      <label>Idle Height (px)</label>
      <input type="text" v-model="idleHeight" />
    </div>
    <div>
      <label>
        Gradient Colors
        <button
          class="btn-none"
          :disabled="colorList.length >= seriesCount"
          @click="addColor"
        >
          +
        </button>
      </label>
      <div class="flex flex-wrap">
        <input
          v-for="e in flatColors"
          :key="e.series * 2 + e.index"
          type="color"
          style="flex-basis: 50%"
          :value="e.color"
          @change="(ev) => setColor(e.series, e.index, ev.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { replaceAt } from "../lib/util";
import eventListenerMixin from "../mixins/eventListenerTracker";
const dummyValidator = {};
dummyValidator.convert = () => dummyValidator;
dummyValidator.check = () => dummyValidator;
dummyValidator.then = () => dummyValidator;
class Validator {
  constructor(value) {
    this.value = value;
  }

  convert(fn) {
    this.value = fn(this.value);
    return this;
  }

  check(fn) {
    if (fn(this.value)) {
      return this;
    }
    return dummyValidator;
  }

  then(fn) {
    fn(this.value);
    return this;
  }
}
const validator = (value) => new Validator(value);

export default {
  name: "Controls",
  props: {
    top: Number,
    left: Number,
    show: Boolean,
    settings: Object,
    seriesCount: Number,
  },
  mixins: [eventListenerMixin],
  data: () => ({
    showSettings: false,
    gamma: "",
    minFreq: "",
    maxFreq: "",
    minDecibels: "",
    maxDecibels: "",
    fftSize: 8192,
    numBars: "",
    barWidth: "",
    barPadding: "",
    edgePadding: "",
    idleHeight: "",
    colorList: [[]],
  }),
  computed: {
    flatColors() {
      return this.colorList.slice(0, this.seriesCount).reduce(
        (acc, curr, seriesIdx) => [
          ...acc,
          ...curr.map((c, i) => ({
            color: c,
            index: i,
            series: seriesIdx,
          })),
        ],
        []
      );
    },
  },
  methods: {
    addColor() {
      if (this.colorList.length < this.seriesCount) {
        this.colorList = [...this.colorList, ["#AA00FF", "#005599"]];
        this.$emit("change", { colorList: this.colorList });
      }
    },
    setColor(series, index, color) {
      if (series < 0 || series >= this.colorList) {
        return;
      }

      validator(color)
        .check((s) => /^#[0-9a-fA-F]{6}$/.test(s))
        .then((s) => {
          this.colorList = replaceAt(this.colorList, series, (c) =>
            replaceAt(c, index, () => s)
          );
        })
        .then(() => this.$emit("change", { colorList: this.colorList }));
    },
  },
  watch: {
    show: {
      immediate: true,
      handler(val) {
        if (val) {
          const onClick = (ev) => {
            if (ev.target === null || !this.$refs.root.contains(ev.target)) {
              this.$emit("blur", ev);
            }
          };
          this.addEventListener({
            target: document.body,
            evtName: "click",
            listener: onClick,
          });
        } else {
          this.removeMatchingEventListeners(
            ({ evtName }) => evtName === "click"
          );
        }
      },
    },
    gamma(val) {
      validator(val)
        .convert((s) => parseFloat(s, 10))
        .check((x) => !Number.isNaN(x) && x > 0)
        .then((x) => this.$emit("change", { gamma: x }));
    },
    minFreq(val) {
      validator(val)
        .convert((s) => parseFloat(s, 10))
        .check((x) => !Number.isNaN(x) && x > 0 && x < this.settings.maxFreq)
        .then((x) => this.$emit("change", { minFreq: x }));
    },
    maxFreq(val) {
      validator(val)
        .convert((s) => parseFloat(s, 10))
        .check((x) => !Number.isNaN(x) && x > 0 && x > this.settings.minFreq)
        .then((x) => this.$emit("change", { maxFreq: x }));
    },
    minDecibels(val) {
      validator(val)
        .convert((s) => parseFloat(s, 10))
        .check(
          (x) => !Number.isNaN(x) && x < 0 && x < this.settings.maxDecibels
        )
        .then((x) => this.$emit("change", { minDecibels: x }));
    },
    maxDecibels(val) {
      validator(val)
        .convert((s) => parseFloat(s, 10))
        .check(
          (x) => !Number.isNaN(x) && x <= 0 && x > this.settings.minDecibels
        )
        .then((x) => this.$emit("change", { maxDecibels: x }));
    },
    numBars(val) {
      validator(val)
        .convert((s) => parseInt(s, 10))
        .check((x) => !Number.isNaN(x) && x > 0)
        .then((x) => this.$emit("change", { numBars: x }));
    },
    barPadding(val) {
      validator(val)
        .convert((s) => parseFloat(s, 10))
        .check((x) => !Number.isNaN(x) && x >= 0 && x < 1)
        .then((x) => this.$emit("change", { barPadding: x }));
    },
    edgePadding(val) {
      validator(val)
        .convert((s) => parseFloat(s, 10))
        .check((x) => !Number.isNaN(x) && x >= 0)
        .then((x) => this.$emit("change", { edgePadding: x }));
    },
    idleHeight(val) {
      validator(val)
        .convert((s) => parseFloat(s, 10))
        .check((x) => !Number.isNaN(x) && x >= 0 && x < 1000)
        .then((x) => this.$emit("change", { idleHeight: x }));
    },
  },
  created() {
    this.$nextTick(() => {
      this.gamma = String(this.settings.gamma);
      this.minFreq = String(this.settings.minFreq);
      this.maxFreq = String(this.settings.maxFreq);
      this.minDecibels = String(this.settings.minDecibels);
      this.maxDecibels = String(this.settings.maxDecibels);
      this.numBars = String(this.settings.numBars);
      this.barWidth = String(this.settings.barWidth);
      this.barPadding = String(this.settings.barPadding);
      this.edgePadding = String(this.settings.edgePadding);
      this.idleHeight = String(this.settings.idleHeight);
      this.colorList = this.settings.colorList.slice();
    });
  },
  beforeUnmount() {
    this.removeAllEventListeners();
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
.btn-none:focus {
  outline: none;
}
.settings {
  position: absolute;
  background: #222;
  color: white;
  opacity: 0.8;
  transition: opacity ease-in 125ms;
  max-width: 400px;
  box-shadow: rgb(0, 0, 0) 0px 3px 5px;
  border-radius: 2px;
  overflow: hidden;

  padding: 0.25rem 0.75rem 0.5rem;
  grid: auto-flow / 1fr 1fr;
  grid-gap: 0.5rem;
  align-items: flex-end;

  label {
    display: block;
    font-size: 0.8175rem;
    color: rgba(255, 255, 255, 0.7);
  }
  input[type="text"] {
    background: #333;
    padding: 0.125rem 0.25rem;
    width: 100px;
  }

  &:hover,
  &:focus {
    opacity: 1;
  }
}
.grid {
  display: grid;
}
</style>
