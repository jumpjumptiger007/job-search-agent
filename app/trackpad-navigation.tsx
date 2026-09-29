"use client";

import { useEffect, useRef } from "react";

export default function TrackpadNavigation() {
  const gesture = useRef({ delta: 0, lastEvent: 0, cooldownUntil: 0 });

  useEffect(() => {
    if (!navigator.userAgent.includes("Electron/")) return;

    function onWheel(event: WheelEvent) {
      const now = performance.now();
      const current = gesture.current;
      if (now < current.cooldownUntil || event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.25) return;

      let element = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
      while (element) {
        const overflowX = window.getComputedStyle(element).overflowX;
        if (element.scrollWidth > element.clientWidth && (overflowX === "auto" || overflowX === "scroll")) {
          current.delta = 0;
          current.lastEvent = 0;
          return;
        }
        element = element.parentElement;
      }

      if (now - current.lastEvent > 180) current.delta = 0;
      current.lastEvent = now;
      current.delta += event.deltaX;
      if (current.delta <= -140 || current.delta >= 140) {
        const back = current.delta <= -140;
        current.delta = 0;
        current.cooldownUntil = now + 700;
        if (back) window.history.back();
        else window.history.forward();
      }
    }

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      gesture.current = { delta: 0, lastEvent: 0, cooldownUntil: 0 };
    };
  }, []);

  return null;
}
