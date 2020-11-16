<template>
  <div id="app">
    <nav>
      <div class="flex container-fluid">
        <h3 class="headline cursor-default">Spectrum Player</h3>
        <span class="spacer"></span>
        <FileInput class="flex" accept="audio/*" multiple @change="addFiles">
          Upload
          <template v-slot:before>
            <span class="file-input-value" v-if="files.length">
              {{ files[showFileIndex].name }}
              <span class="font-sm">{{
                `(${showFileIndex + 1}/${files.length})`
              }}</span>
            </span>
          </template>
        </FileInput>
        <div class="flex" style="align-self: stretch; margin: 0">
          <Controls
            :settings="settings"
            :seriesCount="Math.max(1, files.length)"
            @change="updateSettings"
          />
        </div>
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
    </nav>
    <Visualizer
      :files="files"
      :playState="playState"
      :settings="settings"
      @readystatechange="setCanPlay"
      @finished="stop"
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
import "./css/util.scss";
import FileInput from "./components/FileInput.vue";
import Controls from "./components/Controls.vue";
import Visualizer from "./components/Visualizer.vue";

function getSettings() {
  const defaultPrefs = {
    mode: "Bars",
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
    backgroundColor: "#FFFFFF",
    colorList: [["#7117FF", "#FF6046"]],
  };
  try {
    return {
      ...defaultPrefs,
      ...JSON.parse(localStorage.getItem("spectrum-v0/prefs") || "{}"),
    };
  } catch {
    console.error("Could not read preferences");
  }
  return defaultPrefs;
}

export default {
  name: "App",
  components: {
    Controls,
    FileInput,
    Visualizer,
  },
  data: () => ({
    files: [],
    playState: "stopped",
    canPlay: false,
    showFileIndex: 0,
    settings: getSettings(),
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
    updateSettings(toMerge) {
      this.settings = { ...this.settings, ...toMerge };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "spectrum-v0/prefs",
            JSON.stringify(this.settings)
          );
        } catch {
          console.error("Could not write preferences");
        }
      }
    },
  },
  created() {
    if (typeof window !== "undefined") {
      try {
        this.updateSettings(
          JSON.parse(localStorage.getItem("spectrum-v0/prefs") || "{}")
        );
      } catch {
        console.error("Could not read preferences");
      }
    }
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
nav {
  background: #222;
  color: white;
  height: 46px;

  .container-fluid {
    margin: 0 8px;

    & > * {
      margin-top: 8px;
      margin-bottom: 8px;
    }
  }

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
footer {
  white-space: pre-line;
  position: fixed;
  bottom: 0;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border-top-right-radius: 0.25rem;
  background: rgba(255, 255, 255, 0.84);

  span::after {
    content: "\2000·\2000";
  }
}
</style>
