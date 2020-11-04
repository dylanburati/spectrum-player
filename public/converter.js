#!/usr/bin/env node

// Usage: npx <git:// url> [-o <output>] <input>

const grace = (cb) => {
  try {
    return cb();
  } catch (err) {}
};

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const sharp =
  grace(() => require("sharp")) || fail("Missing dependency: sharp");
const ffmpegPath =
  grace(() => require("ffmpeg-static")) ||
  fail("Missing dependency: ffmpeg-static");

const fs = require("fs");
const path = require("path");
let output = "video.mp4";
const argv = process.argv.slice(2);

const outputIdx = argv.indexOf("-o");
if (outputIdx >= 0) {
  const success = grace(() => {
    output = argv[outputIdx + 1];
    return true;
  });
  if (!success) fail("Expected an arg after -o flag");
}
const input =
  argv.find(
    (e, i) => (outputIdx < 0 || i !== outputIdx + 1) && !/^-[a-zA-Z]$/.test(e)
  ) || fail("Input path is a required argument");
grace(() => fs.existsSync(path.dirname(output))) ||
  fail(`Output directory ${path.dirname(output)} does not exist`);

(async function () {
  const t0 = Date.now();
  let stream = process.stdin;
  if (input !== "-") {
    stream =
      grace(() => fs.createReadStream(input)) ||
      fail("Could not open " + input);
  }
  await fs.promises.mkdir(`tmp-spectrum-${t0}`);
  const numLength = 6;
  const pngName = (i) =>
    path.join(
      `tmp-spectrum-${t0}`,
      `frame-${String(i + 1).padStart(numLength, "0")}.png`
    );

  let inputs = [];
  let readState = {
    promise: null,
    resolve: null,
    fulfilled: false,
    progress: 0
  };
  readState.promise = new Promise(
    (resolve) => (readState.resolve = resolve)
  ).then(() => {
    readState.fulfilled = true;
  });
  let promises = [];
  const progressW = 50;
  console.log("    +" + " ".repeat(progressW) + "+");
  process.stdout.write("    [");
  const updateInputs = (str, isEnd) => {
    const lastUnsubmitted = Math.max(0, inputs.length - 1);
    const lines = str.split("\n");
    if (inputs.length) {
      inputs[inputs.length - 1] += lines[0];
    } else {
      inputs.push(lines[0]);
    }
    inputs.push(...lines.slice(1));

    const submitUntil = inputs.length - (isEnd ? 0 : 1);
    for (let i = lastUnsubmitted; i < submitUntil; i++) {
      if (inputs[i] !== "") {
        promises.push(
          sharp(Buffer.from(inputs[i]))
            .png()
            .toFile(pngName(i))
            .then(() => {
              inputs[i] = null;
              if (!readState.fulfilled) return;
              const done =
                inputs.filter((e) => e === null).length / promises.length;
              if (done === 1) {
                process.stdout.write("]\n");
              } else {
                const nextP = Math.ceil(done * progressW);
                process.stdout.write("=".repeat(nextP - readState.progress));
                readState.progress = nextP;
              }
            })
            .catch(() => {
              console.log("error", i, inputs[i].slice(0, 20));
            })
        );
      }
    }
  };

  stream.on("data", (data) => {
    updateInputs("" + data);
  });
  stream.on("end", (data) => {
    updateInputs(data ? "" + data : "", true);
    readState.resolve();
  });

  await readState.promise;
  await Promise.all(promises);
  console.log(`${promises.length} pngs in ${Date.now() - t0} ms`);

  const formatStr = `tmp-spectrum-${t0}/frame-%0${numLength}d.png`;
  const spawn = require("child_process").spawn;
  const ffmpeg = spawn(ffmpegPath, [
    "-nostdin",
    "-hide_banner",
    "-i",
    formatStr,
    output
  ]);
  ffmpeg.stdout.on("data", (data) => {
    console.log("" + data);
  });
  ffmpeg.stderr.on("data", (data) => {
    console.log("" + data);
  });
  let exitCallback;
  ffmpeg.on("close", (code) => {
    exitCallback();
    console.log("ffmpeg exited with code " + code);
  });
  await new Promise((resolve) => (exitCallback = resolve));

  await fs.promises.rmdir(`tmp-spectrum-${t0}`, { recursive: true });

  process.exit(0);
})();
