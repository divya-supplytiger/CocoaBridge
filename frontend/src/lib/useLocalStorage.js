import { useState } from "react";

export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setAndPersist = (next) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch { /* quota exceeded or unavailable — silently ignore */ }
      return resolved;
    });
  };

  return [value, setAndPersist];
}