const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const analysis = require("../audio-analysis.js");

function setup() {
  class Element {
    constructor(id = "") {
      this.id = id;
      this.value = "";
      this.checked = false;
      this.children = [];
      this.listeners = {};
      this.classes = new Set();
      this.classList = {
        add: (name) => this.classes.add(name),
        remove: (name) => this.classes.delete(name),
        toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
      };
    }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    setAttribute() {}
    replaceChildren(...children) { this.children = children; }
    append(...children) { this.children.push(...children); }
    contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
  }
  const elements = new Map();
  const document = new Element();
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  document.getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, new Element(id));
    return elements.get(id);
  };
  document.createElement = () => new Element();
  document.getElementById("silenceThreshold").value = html.match(/id="silenceThreshold"[^>]*value="([^"]+)"/)[1];
  document.getElementById("roundTotalToggle").checked = true;
  const fakeAnalysis = {
    ...analysis,
    analyzeBuffer: async (duration) => ({
      levels: new Float32Array(Math.round(duration / .02)).fill(-20), frameSeconds: .02, totalSeconds: duration
    })
  };
  const window = { DryVocalAnalysis: fakeAnalysis, OfflineAudioContext: class {
    async decodeAudioData(data) { return data; }
  } };
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  vm.runInNewContext(script, { document, window, setTimeout });
  return { document, get: (id) => document.getElementById(id) };
}

function event(files = [], types = ["Files"]) {
  return { dataTransfer: { types, files }, prevented: false, preventDefault() { this.prevented = true; } };
}
const file = (name, duration) => ({ name, size: 100, arrayBuffer: async () => duration });
async function waitFor(predicate) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("Upload did not finish");
}

test("the page defaults to a -60 dB noise threshold", () => {
  const { get } = setup();
  assert.equal(get("silenceThreshold").value, "-60");
});

test("multi-file drops fill separate lead and harmony inputs and prices", async () => {
  const { get } = setup();
  get("leftUploadBox").listeners.drop(event([file("lead-a.wav", 60), file("lead-b.wav", 10)]));
  get("rightUploadBox").listeners.drop(event([file("harmony.wav", 30)]));
  await waitFor(() => get("leftInput").value === "1:10.00" && get("rightInput").value === "0:30.00");
  assert.equal(get("leftFileList").children.length, 2);
  assert.equal(get("leftResult").textContent, 35);
  assert.equal(get("rightResult").textContent, 10);
  assert.equal(get("totalResult").textContent, 45);
});

test("files dropped during analysis are queued and included in the final total", async () => {
  const { get } = setup();
  let release;
  const pendingData = new Promise((resolve) => { release = resolve; });
  get("leftUploadBox").listeners.drop(event([{ name: "first.wav", size: 100, arrayBuffer: () => pendingData }]));
  get("leftUploadBox").listeners.drop(event([file("next.wav", 5), file("last.wav", 6)]));
  assert.equal(get("leftFileList").children.length, 3);
  release(2);
  await waitFor(() => get("leftInput").value === "0:13.00");
  assert.equal(get("leftResult").textContent, 6.5);
  assert.equal(get("leftFiles").disabled, false);
});

test("nested drag enter/leave keeps highlighting until the whole box is left", () => {
  const { get } = setup();
  const box = get("leftUploadBox");
  box.listeners.dragenter(event());
  box.listeners.dragenter(event());
  box.listeners.dragleave();
  assert.equal(box.classes.has("drag-over"), true);
  box.listeners.dragleave();
  assert.equal(box.classes.has("drag-over"), false);
  const textDrag = event([], ["text/plain"]);
  box.listeners.dragenter(textDrag);
  assert.equal(textDrag.prevented, false);
  assert.equal(box.classes.has("drag-over"), false);
});

test("file drops outside upload boxes cannot navigate away or leave stale highlighting", () => {
  const { document, get } = setup();
  const box = get("leftUploadBox");
  box.listeners.dragenter(event());
  const drop = event([file("outside.wav", 3)]);
  document.listeners.drop(drop);
  assert.equal(drop.prevented, true);
  assert.equal(box.classes.has("drag-over"), false);
  assert.equal(get("leftInput").value, "");
  const over = event();
  over.target = document;
  document.listeners.dragover(over);
  assert.equal(over.dataTransfer.dropEffect, "none");
});
