<template>
  <div>
    <div class="flex navbar">
      <h3 class="headline cursor-default">Audio Spectrum Generator</h3>
      <span class="spacer"></span>
      <FileInput accept="audio/*" @change="setFile">
        Upload
        <template v-slot:after>
          <span v-if="file">
            {{ file.name }}
          </span>
          <span v-else class="file-formats">Works with any audio file</span>
        </template>
      </FileInput>
      <span class="spacer"></span>
      <button class="btn" @click="play" :disabled="!canPlay">
        {{ isPlaying ? "⏸" : "▶" }}
      </button>
      <button class="btn" @click="reset">Reset</button>
    </div>
    <Controls
      :settings="settings"
      @change="(toMerge) => (settings = { ...settings, ...toMerge })"
    />
    <Visualizer
      :file="file"
      :isPlaying="isPlaying"
      :isPaused="isPaused"
      :settings="settings"
      @readystatechange="setCanPlay"
      @finished="() => (isPlaying = false)"
    />
  </div>
</template>

<script>
import "tailwindcss/dist/base.css";
import FileInput from "./components/FileInput.vue";
import Controls from "./components/Controls.vue";
import Visualizer from "./components/Visualizer.vue";
export default {
  name: "App",
  components: {
    Controls,
    FileInput,
    Visualizer,
  },
  data: () => ({
    file: null,
    isPlaying: false,
    isPaused: false,
    canPlay: false,
    settings: {
      renderOnline: true,
      enableRecording: false,
      gamma: 2,
      minFreq: 25,
      maxFreq: 15000,
      fftSize: 8192,
      numBars: 100,
      barWidth: "fit",
      barPadding: 0.25,
      edgePadding: 3,
      idleHeight: 3,
      colorList: ["#7117EA", "#EA6060"],
    },
  }),
  methods: {
    setFile(ev) {
      this.file = Array.from(ev.target.files)[0];
    },
    play() {
      // F F -> T F (playing)
      // T F -> F T (paused)
      // F T -> T F (playing)
      if (this.canPlay) {
        this.isPaused = this.isPlaying;
        this.isPlaying = !this.isPlaying;
      }
    },
    reset() {
      this.isPlaying = false;
      this.isPaused = false;
    },
    setCanPlay(val) {
      this.canPlay = val;
      if (!val) this.reset();
    },
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
.spacer {
  flex-grow: 1;
}
.headline {
  font-size: 1.1875rem;
}
.cursor-default {
  cursor: default;
}
.btn,
.btn-secondary {
  min-width: 24px;
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
.btn:focus,
.btn-secondary:focus,
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

  .btn {
    margin-left: 0.25rem;
  }
}
.file-formats {
  line-height: 1;
  font-size: 0.8175rem;
  color: rgb(221, 221, 221);
  display: inline-block;
}
</style>