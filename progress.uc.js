// ==UserScript==
// @name           Arc Swipe Progress
// @version        1.2.0
// @description    Match the edge background opacity to native swipe progress.
// @include        main
// ==/UserScript==

(() => {
  "use strict";

  if (location.href !== "chrome://browser/content/browser.xhtml") return;
  const host = window.gHistorySwipeAnimation;
  if (!host || typeof host.updateAnimation !== "function") return;
  window.arcSwipeProgress?.destroy();

  const original = host.updateAnimation;
  function updateAnimation(update, ...args) {
    const result = original.call(this, update, ...args);
    // Keep the last visible opacity during native cancellation/fade-out.
    // Never replace the box opacity, which Zen owns for overlay cleanup.
    if (this._isStoppingAnimation || !Number.isFinite(update?.delta)) return result;
    const progress = Math.min(1, Math.abs(update.delta) / 0.25);
    for (const box of [this._prevBox, this._nextBox]) {
      if (box && !box.collapsed) {
        box.style.setProperty("--arc-swipe-progress", String(progress));
      }
    }
    return result;
  }

  const controller = {
    destroy() {
      if (host.updateAnimation === updateAnimation) host.updateAnimation = original;
      for (const box of [host._prevBox, host._nextBox, host._lastVisibleBox]) {
        box?.style.removeProperty("--arc-swipe-progress");
      }
      if (window.arcSwipeProgress === controller) delete window.arcSwipeProgress;
      window.removeEventListener("unload", controller.destroy);
    },
  };
  host.updateAnimation = updateAnimation;
  window.arcSwipeProgress = controller;
  window.addEventListener("unload", controller.destroy, { once: true });
  if (typeof window.addUnloadListener === "function") {
    window.addUnloadListener(controller.destroy);
  }
})();
