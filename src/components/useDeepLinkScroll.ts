"use client";

import { useEffect } from "react";

/** Rola até o elemento do hash (#id) e destaca brevemente. */
export function useDeepLinkScroll(extraDelay = 0) {
  useEffect(() => {
    const run = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const el = document.getElementById(hash);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-brand-500", "ring-offset-2", "rounded-xl");
      const input = el.querySelector<HTMLElement>("input, textarea, select");
      if (input) setTimeout(() => input.focus(), 400);
      const timer = setTimeout(() => {
        el.classList.remove("ring-2", "ring-brand-500", "ring-offset-2", "rounded-xl");
      }, 3000);
      return () => clearTimeout(timer);
    };
    const t = setTimeout(run, 80 + extraDelay);
    return () => clearTimeout(t);
  }, []);
}
