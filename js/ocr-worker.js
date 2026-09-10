/* ocr-worker.js — the Battle Simulator's OCR engine, off the main thread.
   PaddleOCR.js/ONNX Runtime/OpenCV are megabytes of JavaScript plus a wasm
   session compile; running them on the page thread froze the tab for seconds
   on a phone (and the whole image decode + inference with it). This worker owns
   all of it: js/sim.js only posts the picked File and waits for recognised
   words, so the page stays interactive and the model warm-up never blocks.

   The engine module comes from jsdelivr (ESM, no bundler needed); the ~6 MB
   model pair is self-hosted at /models/ because the upstream Baidu bucket sends
   broken CORS headers. Model URLs are resolved from this file's own location so
   the worker works at any page depth, and are absolute because a worker's
   relative fetches resolve against the worker script, not the page.

   Protocol — one request, one reply, matched by id:
     in : { id, type: 'warm' }                  → { id, ok: true }
     in : { id, type: 'predict', blob: File }   → { id, ok: true, items, metrics }
     any failure                                → { id, ok: false, error }
   'predict' implies 'warm'; both share one engine promise. */
'use strict';

// ── Worker environment stubs ──────────────────────────
// PaddleOCR.js's bitmapToSourceMat() builds its Mat through
// document.createElement("canvas"), and OpenCV's imread() dereferences
// HTMLImageElement in an instanceof check before the OffscreenCanvas branch it
// should take. Neither global exists in a worker — the stubs are enough, and
// the OffscreenCanvas path then runs unchanged.
globalThis.document = {
  createElement: function () { return new OffscreenCanvas(1, 1); }
};
globalThis.HTMLImageElement = function HTMLImageElement() {};
globalThis.HTMLCanvasElement = function HTMLCanvasElement() {};

var PADDLE_ESM = 'https://cdn.jsdelivr.net/npm/@paddleocr/paddleocr-js@0.4.2/+esm';

function modelsUrl(file) {
  return new URL('../models/' + file, self.location.href).href;
}

var enginePromise = null;

// Import + session build happen once, inside this worker. `worker: false` is
// deliberate: this file *is* the worker, so the pipeline runs directly here
// rather than the library spawning a second one.
function loadEngine() {
  if (enginePromise) return enginePromise;
  var p = import(PADDLE_ESM).then(function (m) {
    return m.PaddleOCR.create({
      worker: false,
      textDetectionModelName: 'PP-OCRv6_tiny_det',
      textRecognitionModelName: 'PP-OCRv6_tiny_rec',
      textDetectionModelAsset: { url: modelsUrl('det-v6-tiny.tar') },
      textRecognitionModelAsset: { url: modelsUrl('rec-v6-tiny.tar') }
    });
  });
  enginePromise = p;
  // A failed load must not poison later attempts (offline, quota, one bad
  // session build) — clear the cache so the next request retries.
  p.catch(function () { if (enginePromise === p) enginePromise = null; });
  return p;
}

self.onmessage = function (e) {
  var msg = e.data || {};
  var id = msg.id;
  var reply = function (out) { out.id = id; self.postMessage(out); };
  var fail = function (err) { reply({ ok: false, error: String((err && err.message) || err) }); };

  if (msg.type === 'warm') {
    loadEngine().then(function () { reply({ ok: true }); }, fail);
  } else if (msg.type === 'predict') {
    loadEngine()
      .then(function (ocr) { return ocr.predict(msg.blob); })
      .then(function (res) {
        var first = res && res[0];
        reply({
          ok: true,
          items: (first && first.items) || [],
          metrics: (first && first.metrics) || null
        });
      }, fail);
  }
};
