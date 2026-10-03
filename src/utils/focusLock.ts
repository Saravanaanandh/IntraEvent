import { useCallback, useEffect, useRef, useState } from 'react';
import { enterFullscreen, isFullscreen, consumeExitSuppression } from './fullscreen';

// Focus lock for active rounds: takes fullscreen on mount, blocks the arena
// with a resume overlay if fullscreen is exited, and reports tab-hide /
// fullscreen-exit violations to the server (visible to admins).
export function useFocusLock(participantId: string | null, active: boolean) {
  const [fsBlocked, setFsBlocked] = useState(false);
  const [violations, setViolations] = useState(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  // Only block when fullscreen was achieved and then lost — never brick
  // the round on browsers that deny the initial request.
  const hadFs = useRef(false);

  const report = useCallback(
    (kind: 'tab' | 'fs') => {
      if (!participantId) return;
      setViolations((v) => v + 1);
      fetch('/api/participant/violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, kind }),
      }).catch(() => {});
    },
    [participantId]
  );

  useEffect(() => {
    if (!active || !participantId) return;
    // Best-effort: the Start button also requests it inside the click gesture.
    void enterFullscreen().then((ok) => {
      if (ok || isFullscreen()) {
        hadFs.current = true;
        setFsBlocked(false);
      }
    });
    const onFs = () => {
      if (!activeRef.current) return;
      if (!isFullscreen()) {
        // Our own programmatic exit (submit/finish) is not a violation.
        if (consumeExitSuppression()) {
          setFsBlocked(false);
          return;
        }
        if (hadFs.current) {
          setFsBlocked(true);
          report('fs');
        }
      } else {
        hadFs.current = true;
        setFsBlocked(false);
      }
    };
    const onVis = () => {
      if (!activeRef.current) return;
      if (document.hidden) report('tab');
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      activeRef.current = false;
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active, participantId, report]);

  const resume = useCallback(async () => {
    const ok = await enterFullscreen();
    if (ok) setFsBlocked(false);
  }, []);

  return { fsBlocked, violations, resume };
}
