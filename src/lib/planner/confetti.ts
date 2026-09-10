"use client";

import confetti from "canvas-confetti";

/** A celebratory burst for the moment a decision closes — kept in one place so the feel stays consistent everywhere it fires. */
export function celebrateDecisionClosed() {
  const colors = ["#8A5A7A", "#6E5A7A", "#A9709A", "#6E8C6A", "#A98A5A"];
  const common = { colors, disableForReducedMotion: true };

  confetti({ ...common, particleCount: 70, spread: 65, origin: { x: 0.3, y: 0.6 }, angle: 60 });
  confetti({ ...common, particleCount: 70, spread: 65, origin: { x: 0.7, y: 0.6 }, angle: 120 });
}
