<template>
  <g>
    <path
      v-for="(d, i) in paths"
      :key="i"
      :fill="`url(#grd-${Math.floor((paths.length - i - 1) / 2)}-${i % 2})`"
      :d="d"
      stroke-width="0"
    />
  </g>
</template>

<script>
import {
  cubicBezierCurves,
  line,
  absLines,
  reversePathComponents,
  toPath,
} from "../lib/curve";

export default {
  name: "AreaGroup",
  props: {
    x: Number,
    y: Number,
    height: Number,
    pointSeparation: Number,
    numPoints: Number,
    idleHeight: Number,
    colors: Array,
    spectrum: Array,
  },
  computed: {
    paths() {
      const firstX = this.x;
      const lastX = this.x + (this.numPoints - 1) * this.pointSeparation;
      const maxY = this.y + this.height;
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
                (d) => d.x * this.pointSeparation + firstX,
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
            ]),
            toPath([
              ...prevTop,
              line(
                [lastX, bottom[0].start],
                [lastX, maxY],
                (d) => d[0],
                (d) => d[1]
              ),
              line(
                [lastX, maxY],
                [firstX, maxY],
                (d) => d[0],
                (d) => d[1]
              ),
            ])
          );
          prevTop = top;
        }
      }
      if (!paths.length) {
        paths.push(
          toPath([
            ...absLines(
              [
                [firstX, maxY - this.idleHeight],
                [lastX, maxY - this.idleHeight],
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
    gradients() {
      const colorList = this.colors.slice();
      while (colorList.length < this.spectrum.length) {
        colorList.push(colorList[colorList.length - 1].slice().reverse());
      }
      return colorList;
    },
  },
  watch: {
    gradients: {
      immediate: true,
      handler(next) {
        const defs = next
          .map(
            ([c1, c2], i) =>
              this.linearGradient(`grd-${i}-0`, c1, 0.7, c2, 0.7).outerHTML +
              this.linearGradient(`grd-${i}-1`, c1, 0.3, c2, 0.3).outerHTML
          )
          .join("");
        this.$nextTick(() => {
          this.$emit("set-defs", defs);
        });
      },
    },
  },
  methods: {
    linearGradient(id, color1, alpha1, color2, alpha2) {
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
            "stop-opacity": alpha1,
          }),
          mk("stop", {
            offset: "100%",
            "stop-color": color2,
            "stop-opacity": alpha2,
          }),
        ],
      });
    },
  },
};
</script>
