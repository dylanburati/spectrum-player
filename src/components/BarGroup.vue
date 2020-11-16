<template>
  <g>
    <g
      v-for="(r, i) in rects"
      :key="i"
      :fill="barColors[r.series][r.x]"
      :transform="`translate(${(r.x * pointSeparation + x).toFixed(3)},0)`"
      :width="pointSeparation"
      stroke-width="0"
    >
      <rect :y="r.y" :width="barWidth" :height="r.h" />
    </g>
  </g>
</template>

<script>
import { rgbToHSL, interpHSL, parseRGB } from "../lib/colorConvert";
import { flatMap, buildList } from "../lib/util";

export default {
  name: "BarGroup",
  props: {
    x: Number,
    y: Number,
    height: Number,
    pointSeparation: Number,
    barWidth: Number,
    numPoints: Number,
    idleHeight: Number,
    colors: Array,
    spectrum: Array,
  },
  computed: {
    rects() {
      if (this.spectrum.length) {
        return flatMap(this.spectrum, (spec, i) =>
          spec.map((e) => ({
            ...e,
            series: i,
          }))
        );
      }
      return buildList(this.numPoints, (i) => ({
        series: 0,
        x: i,
        y: this.height - this.idleHeight,
        h: this.idleHeight,
      }));
    },
    barColors() {
      const numBars = this.numPoints;
      const gradients = this.colors.map((txtColors) => {
        const rgbList = txtColors.map(parseRGB);
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
      while (gradients.length < this.spectrum.length) {
        gradients.push(gradients[gradients.length - 1].slice().reverse());
      }
      return gradients;
    },
  },
  watch: {
    colors: {
      immediate: true,
      handler(next) {
        const colorList = next.slice();
        while (colorList.length < Math.max(1, this.spectrum.length)) {
          colorList.push(colorList[colorList.length - 1].slice().reverse());
        }
        const defs = colorList
          .map(
            ([c1, c2], i) =>
              this.linearGradient(`gradient${i}`, c1, c2).outerHTML
          )
          .join("");
        this.$nextTick(() => {
          this.$emit("set-defs", defs);
        });
      },
    },
  },
  methods: {
    linearGradient(id, color1, color2) {
      const mk = (tag, props) => {
        const el = document.createElement(tag);
        const { children = [], ...attrs } = props;
        for (let k in attrs) el.setAttribute(k, String(attrs[k]));
        children.forEach((c) => el.appendChild(c));
        return el;
      };
      return mk("linearGradient", {
        id,
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 0,
        children: [
          mk("stop", {
            offset: "0%",
            "stop-color": color1,
            "stop-opacity": 1,
          }),
          mk("stop", {
            offset: "100%",
            "stop-color": color2,
            "stop-opacity": 1,
          }),
        ],
      });
    },
  },
};
</script>
