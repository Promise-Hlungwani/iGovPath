"use client";

import { useEffect } from "react";

/** Brings the page back to the top when it opens (e.g. after sending a long form from its last button). */
export function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return null;
}
