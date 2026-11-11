"use client";
import { useState } from "react";

// Drag-to-reorder for the workout's exercise cards.
// Hold the ⋮⋮ handle on a card and drag it up or down; works with a finger or a mouse.
export default function useDragReorder(setEntries) {
  const [dragIndex, setDragIndex] = useState(null);

  function startDrag(i, ev) {
    ev.preventDefault();
    const d = { index: i, y: ev.clientY };
    document.body.classList.add("ex-dragging");
    setDragIndex(i);
    const reorderAt = () => {
      const cur = d.index;
      const n = document.querySelectorAll(".ex-card").length;
      for (let k = 0; k < n; k++) {
        if (k === cur) continue;
        const r = document.getElementById(`ex-card-${k + 1}`)?.getBoundingClientRect();
        if (!r) continue;
        const mid = r.top + r.height / 2;
        if ((k < cur && d.y < mid && d.y > r.top - 40) || (k > cur && d.y > mid && d.y < r.bottom + 40)) {
          setEntries((list) => { const next = [...list]; const [x] = next.splice(cur, 1); next.splice(k, 0, x); return next; });
          d.index = k; setDragIndex(k);
          if (navigator.vibrate) navigator.vibrate(10);
          break;
        }
      }
    };
    const move = (e) => { d.y = e.clientY; reorderAt(); };
    // Scroll the page when you drag near the top or bottom of the screen
    const timer = setInterval(() => {
      if (d.y < 90) window.scrollBy(0, -14);
      else if (d.y > window.innerHeight - 90) window.scrollBy(0, 14);
      else return;
      reorderAt();
    }, 16);
    const end = () => {
      clearInterval(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      document.body.classList.remove("ex-dragging");
      setDragIndex(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  // Tap-to-move: put exercise i at position `to` (0 = first), then scroll to it and flash it
  function moveTo(i, to) {
    if (i === to) return;
    setEntries((list) => { const next = [...list]; const [x] = next.splice(i, 1); next.splice(to, 0, x); return next; });
    setTimeout(() => {
      const el = document.getElementById(`ex-card-${to + 1}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("ex-moved"); void el.offsetWidth; el.classList.add("ex-moved");
    }, 60);
  }

  return { dragIndex, startDrag, moveTo };
}
