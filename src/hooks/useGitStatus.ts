import { useState, useEffect, useRef } from "react";
import { getGitStatus } from "../lib/tauri";
import type { GitStatus } from "../lib/types";

const POLL_INTERVAL = 5000; // 5 seconds

/**
 * Polls git status for a given path. Returns null if no path or on error.
 */
export function useGitStatus(path: string | null | undefined): GitStatus | null {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!path) {
      setStatus(null);
      return;
    }

    const fetchStatus = () => {
      getGitStatus(path)
        .then(setStatus)
        .catch(() => setStatus(null));
    };

    // Fetch immediately
    fetchStatus();

    // Poll periodically
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [path]);

  return status;
}
