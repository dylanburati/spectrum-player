<template>
  <div class="settings" :style="showSettings && { opacity: 1 }">
    <div class="flex settings-cta">
      <span class="cursor-default">Customize</span>
      <button class="btn-none" @click="() => (showSettings = !showSettings)">
        {{ showSettings ? "▲" : "▼" }}
      </button>
    </div>
    <div class="grid" v-if="showSettings">
      <div>
        <label>Gamma</label>
        <input type="text" v-model="gamma" />
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
        <label>Number of Bars</label>
        <input type="text" v-model="numBars" />
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
        <label>Gradient Colors</label>
        <div class="flex">
          <input
            v-for="(color, i) in colorList"
            :key="i"
            type="color"
            style="flex-grow: 1"
            :value="color"
            @change="(ev) => setColor(i, ev.target.value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
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
  },
  // {
  //   renderOnline: true,
  //   enableRecording: false,
  //   gamma: 2,
  //   minFreq: 25,
  //   maxFreq: 15000,
  //   fftSize: 8192,
  //   numBars: 64,
  //   barWidth: "fit",
  //   barPadding: 0.25,
  //   edgePadding: 0.4,
  //   idleHeight: 3,
  // },
  data: () => ({
    showSettings: false,
    gamma: "",
    minFreq: "",
    maxFreq: "",
    fftSize: 8192,
    numBars: "",
    barWidth: "",
    barPadding: "",
    edgePadding: "",
    idleHeight: "",
    colorList: "",
  }),
  methods: {
    setColor(index, color) {
      if (index < 0 || index >= this.colorList) {
        return;
      }

      validator(color)
        .check((s) => /^#[0-9a-fA-F]{6}$/.test(s))
        .then((s) => {
          this.colorList = this.colorList.map((prev, i) =>
            i === index ? s : prev
          );
        })
        .then(() => this.$emit("change", { colorList: this.colorList }));
    },
  },
  watch: {
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
        .check((x) => !Number.isNaN(x) && x < 1000 && x > -1000)
        .then((x) => this.$emit("change", { idleHeight: x }));
    },
  },
  created() {
    this.$nextTick(() => {
      this.gamma = String(this.settings.gamma);
      this.minFreq = String(this.settings.minFreq);
      this.maxFreq = String(this.settings.maxFreq);
      this.numBars = String(this.settings.numBars);
      this.barWidth = String(this.settings.barWidth);
      this.barPadding = String(this.settings.barPadding);
      this.edgePadding = String(this.settings.edgePadding);
      this.idleHeight = String(this.settings.idleHeight);
      this.colorList = this.settings.colorList.slice();
    });
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
.btn-none:focus {
  outline: none;
}
.settings-cta {
  span {
    margin: 0.5rem 2rem 0.5rem 0.75rem;
  }

  button {
    margin-left: auto;
    padding: 0.5rem 0.75rem;
  }
}
.settings {
  position: absolute;
  background: #222;
  color: white;
  opacity: 0.6;
  transition: opacity ease-in 125ms;
  max-width: 400px;
  margin-left: 30px;
  margin-top: 30px;
  box-shadow: rgb(0, 0, 0) 0px 3px 5px;
  border-radius: 2px;
  overflow: hidden;

  &:hover,
  &:focus {
    opacity: 1;
  }

  .grid {
    padding: 0.25rem 0.75rem 0.5rem;
    grid: auto-flow / 1fr 1fr;
    grid-gap: 0.5rem;
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
  }
}
.grid {
  display: grid;
}
</style>
