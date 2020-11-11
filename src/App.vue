<template>
  <div id="app">
    <div class="flex navbar">
      <h3 class="headline cursor-default">Spectrum Player</h3>
      <span class="spacer"></span>
      <FileInput
        class="flex"
        style="align-self: stretch"
        accept="audio/*"
        multiple
        @change="addFiles"
      >
        Upload
        <template v-slot:before>
          <span class="file-input-value" v-if="files.length">
            {{ files[showFileIndex].name }}
            <span class="font-sm">{{
              `(${showFileIndex + 1}/${files.length})`
            }}</span>
          </span>
        </template>
        <template v-slot:after>
          <button
            class="btn-flat settings-dropdown"
            ref="dropBtn"
            @click="toggleShowSettings"
          >
            <unicon name="sliders-v" />
          </button>
        </template>
      </FileInput>
      <span class="spacer"></span>
      <button class="btn" @click="play" :disabled="!canPlay">
        <unicon
          :name="playState === 'playing' ? 'pause' : 'play'"
          height="16"
          width="16"
        />
      </button>
      <button class="btn" @click="stop" :disabled="playState === 'stopped'">
        <unicon name="square" height="16" width="16" />
      </button>
      <button class="btn" @click="reset">Reset</button>
    </div>
    <Controls
      :show="showSettings"
      :top="dropdownPosition.top"
      :left="dropdownPosition.left"
      :settings="settings"
      :seriesCount="Math.max(1, files.length)"
      @blur="onDropdownBlur"
      @change="(toMerge) => (settings = { ...settings, ...toMerge })"
    />
    <Visualizer
      :files="files"
      :playState="playState"
      :settings="settings"
      @readystatechange="setCanPlay"
      @finished="() => (playState = 'stopped')"
    />
    <footer>
      <span>Copyright (c) 2020, Dylan Burati</span>
      <a
        href="https://github.com/dylanburati/spectrum-player"
        target="_blank"
        rel="noreferrer"
        v-text="'Source code'"
      />
    </footer>
  </div>
</template>

<script>
import "tailwindcss/dist/base.css";
import FileInput from "./components/FileInput.vue";
import Controls from "./components/Controls.vue";
import Visualizer from "./components/Visualizer.vue";
import eventListenerMixin from "./mixins/eventListenerTracker";

export default {
  name: "App",
  components: {
    Controls,
    FileInput,
    Visualizer,
  },
  mixins: [eventListenerMixin],
  data: () => ({
    files: [],
    playState: "stopped",
    canPlay: false,
    showFileIndex: 0,
    showSettings: false,
    dropdownPosition: {
      top: 46,
      left: 200,
    },
    settings: {
      gamma: 1.5,
      minFreq: 25,
      maxFreq: 15000,
      minDecibels: -90,
      maxDecibels: -15,
      fftSize: 8192,
      numBars: 100,
      barWidth: "fit",
      barPadding: 0.25,
      edgePadding: 3,
      idleHeight: 3,
      colorList: [["#7117FF", "#FF6046"]],
    },
  }),
  methods: {
    addFiles(ev) {
      this.files = [...this.files, ...Array.from(ev.target.files)];
    },
    play() {
      if (this.canPlay) {
        this.playState = this.playState === "playing" ? "paused" : "playing";
      }
    },
    stop() {
      this.playState = "stopped";
    },
    reset() {
      this.stop();
      this.files = [];
    },
    setCanPlay(val) {
      this.canPlay = val;
      if (!val) this.stop();
    },
    toggleShowSettings() {
      const next = !this.showSettings;
      if (next) {
        const onResize = () => {
          const dropBtn = this.$refs.dropBtn;
          const rect = dropBtn.getBoundingClientRect();
          this.dropdownPosition.top = rect.bottom;
          this.dropdownPosition.left = rect.left;
        };
        onResize();
        this.addEventListener({
          target: window,
          evtName: "resize",
          listener: onResize,
        });
      } else {
        this.removeMatchingEventListeners(
          ({ evtName }) => evtName === "resize"
        );
      }
      this.showSettings = next;
    },
    onDropdownBlur(ev) {
      if (!this.$refs.dropBtn.contains(ev.target)) {
        this.showSettings = false;
      }
    },
  },
  beforeUnmount() {
    this.removeAllEventListeners();
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.relative {
  position: relative;
}
.flex {
  display: flex;
  align-items: center;
}
.flex-wrap {
  flex-wrap: wrap;
}
.justify-center {
  justify-content: center;
}
.flex-col {
  flex-direction: column;
}
.spacer {
  flex-grow: 1;
}
.headline {
  font-size: 1.1875rem;
}
.cursor-default {
  cursor: default;
}
a {
  color: #2b72ab;

  &:hover {
    text-decoration: underline;
  }
}
.btn,
.btn-secondary,
.btn-flat {
  min-width: 24px;
  overflow: hidden;
  white-space: pre;
  text-overflow: ellipsis;
  padding: 0.125rem 0.375rem;
  border-radius: 2px;
}
.btn {
  background: rgb(9, 113, 241);
  color: white;

  &:hover {
    background: rgb(58, 141, 244);
  }

  &[disabled] {
    background: #505050;
    color: #ddd;
    cursor: not-allowed;
  }
}
.btn-secondary {
  background-color: #efefef;
  color: black;

  &:hover {
    background: #e0e0e0;
  }

  &[disabled] {
    background: #ddd;
    color: #555;
    cursor: not-allowed;
  }
}
.btn-flat {
  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  &[disabled] {
    color: #bbb;
    cursor: not-allowed;
  }
}
.btn:focus,
.btn-secondary:focus,
.btn-flat:focus,
.btn-none:focus {
  outline: none;
}
.font-sm {
  font-size: 0.8175rem;
}
.navbar {
  background: #222;
  color: white;
  padding: 8px;
  height: 46px;

  .file-input-value,
  .headline {
    display: inline-block;
    white-space: pre;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .file-input-value {
    max-width: 25vw;
  }

  .btn {
    margin-left: 0.25rem;
  }

  .unicon {
    margin-bottom: -3px;
  }
}
.settings-dropdown {
  align-self: stretch;
  margin: -8px 0 -8px;
}
footer {
  white-space: pre-line;
  position: fixed;
  bottom: 0;
  margin: 0.75rem;
  font-size: 0.875rem;

  span::after {
    content: "\2000·\2000";
  }
}
</style>
