import { partition } from "../lib/util";

export default {
  data: () => ({
    eventListeners: [],
  }),
  methods: {
    addEventListener(options) {
      this.eventListeners.push(options);
      const { target, evtName, listener } = options;
      target.addEventListener(evtName, listener);
    },
    removeMatchingEventListeners(predicate) {
      const [toRemove, rest] = partition(this.eventListeners, predicate);
      toRemove.forEach(({ target, evtName, listener }) => {
        target.removeEventListener(evtName, listener);
      });
      this.eventListeners = rest;
    },
    removeAllEventListeners() {
      this.eventListeners.forEach(({ target, evtName, listener }) => {
        target.removeEventListener(evtName, listener);
      });
      this.eventListeners = [];
    },
  },
};
