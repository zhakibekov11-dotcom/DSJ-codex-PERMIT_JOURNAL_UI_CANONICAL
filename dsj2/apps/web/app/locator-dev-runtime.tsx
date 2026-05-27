"use client";

import { useEffect } from "react";

export function LocatorDevRuntime() {
  useEffect(() => {
    let isMounted = true;

    async function initializeLocator() {
      const { default: setupLocator } = await import("@locator/runtime");

      if (!isMounted) {
        return;
      }

      setupLocator({
        adapter: "jsx",
      });
    }

    void initializeLocator();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
