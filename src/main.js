import Vue from "vue";
import App from "./App.vue";
import Unicon from "vue-unicons";
import {
  uniPlay,
  uniPause,
  uniSquare,
  uniSlidersV,
} from "vue-unicons/src/icons";

Unicon.add([uniPlay, uniPause, uniSquare, uniSlidersV]);
Vue.use(Unicon, { fill: "currentColor" });

new Vue({
  render: (h) => h(App),
}).$mount("#app");
