<template>
  <div class="relative h-full">
    <button class="btn-flat h-full settings-dropdown" @click="show = !show">
      <unicon name="sliders-v" />
    </button>
    <button
      v-if="show"
      @click="show = false"
      tabindex="-1"
      class="fixed inset-0 h-full w-full bg-black opacity-50 cursor-default"
    ></button>
    <div class="settings grid" ref="root" v-show="show">
      <div style="grid-column: 1 / span 2">
        <label>Mode: </label>
        <select v-model="mode">
          <option value="Bars">Bars</option>
          <option value="Area">Area</option>
        </select>
      </div>
      <div class="form-group">
        <label>Gamma</label>
        <input type="text" v-model="gamma" />
      </div>
      <div class="form-group">
        <label>Number of Points</label>
        <input type="text" v-model="numBars" />
      </div>
      <div class="form-group">
        <label>Min Frequency</label>
        <input type="text" v-model="minFreq" />
      </div>
      <div class="form-group">
        <label>Max Frequency</label>
        <input type="text" v-model="maxFreq" />
      </div>
      <div class="form-group">
        <label>Min dB</label>
        <input type="text" v-model="minDecibels" />
      </div>
      <div class="form-group">
        <label>Max dB</label>
        <input type="text" v-model="maxDecibels" />
      </div>
      <div class="form-group">
        <label>In-Between Spacing (0&#x2011;1)</label>
        <input type="text" v-model="barPadding" />
      </div>
      <div class="form-group">
        <label>Edge Spacing</label>
        <input type="text" v-model="edgePadding" />
      </div>
      <div class="form-group">
        <label>Idle Height (px)</label>
        <input type="text" v-model="idleHeight" />
      </div>
      <div class="form-group">
        <label>Background Color</label>
        <input type="color" v-model="backgroundColor" />
      </div>
      <div class="form-group">
        <label>
          Gradient Colors
          <button class="btn" @click="addColor">+</button>
          <button v-if="colorList.length > 1" class="btn" @click="removeColor">
            -
          </button>
        </label>
        <div class="flex flex-wrap">
          <input
            v-for="e in flatColors"
            :key="e.series * 2 + e.index"
            type="color"
            style="flex-basis: 50%"
            :value="e.color"
            @input="(ev) => setColor(e.series, e.index, ev.target.value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { flatMap, replaceAt } from "../lib/util";
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
    settings: Object,
    seriesCount: Number,
  },
  data: () => ({
    show: false,
    mode: "",
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
    backgroundColor: "",
    colorList: [[]],
  }),
  computed: {
    flatColors() {
      return flatMap(this.colorList, (curr, seriesIdx) =>
        curr.map((c, i) => ({
          color: c,
          index: i,
          series: seriesIdx,
        }))
      );
    },
  },
  methods: {
    addColor() {
      this.colorList = [...this.colorList, ["#AA00FF", "#005599"]];
      this.$emit("change", { colorList: this.colorList });
    },
    removeColor() {
      this.colorList = this.colorList.slice(0, -1);
      this.$emit("change", { colorList: this.colorList });
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
    mode(val) {
      validator(val)
        .check((s) => s === "Bars" || s === "Area")
        .then((s) => this.$emit("change", { mode: s }));
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
    backgroundColor(val) {
      validator(val)
        .check((s) => /^#[0-9a-fA-F]{6}$/.test(s))
        .then(() => this.$emit("change", { backgroundColor: val }));
    },
  },
  created() {
    this.$nextTick(() => {
      this.mode = this.settings.mode;
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
      this.backgroundColor = this.settings.backgroundColor;
      this.colorList = this.settings.colorList.slice();
    });
  },
};
</script>

<style lang="scss">
.settings-dropdown {
  padding-top: 5px;
}
.settings {
  position: absolute;
  right: 0;
  background: #222;
  color: white;
  opacity: 0.8;
  transition: opacity ease-in 125ms;
  width: 25vw;
  max-width: 320px;
  box-shadow: rgb(0, 0, 0) 0px 3px 5px;
  border-radius: 2px;
  overflow: hidden;

  padding: 1rem 0.75rem 0.5rem;
  grid: auto-flow / 1fr 1fr;
  grid-gap: 0.5rem;
  align-items: flex-end;

  label {
    font-size: 0.8175rem;
    color: rgba(255, 255, 255, 0.7);
  }
  input[type="text"],
  select {
    background: #333;
    padding: 0.125rem 0.25rem;
  }
  input[type="text"] {
    width: 100px;
  }
  select {
    width: 200px;
  }
  input[type="color"] {
    width: 60px;
    max-width: 60px;
  }
  .btn {
    margin-bottom: 2px;
    min-width: 3ex;
    padding: 0;
  }

  &:hover,
  &:focus {
    opacity: 1;
  }
}
.form-group label {
  display: block;
}
</style>
