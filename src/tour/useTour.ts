import { useCallback, useEffect } from 'react';
import { startTour, stopTour } from './tour';
import { seenKeyFor, stepsFor } from './steps';
import type { ScreenName } from '../state/types';

/** The screen currently on show, so TopBar can offer its replay button. */
let current: ScreenName | null = null;
export const tourAvailable = (): boolean => Boolean(current && stepsFor(current).length > 0);
export const replayTour = async () => {
  if (!current) return;
  const screen = current;
  if (screen === 'world' && window.echoeFocusTourTarget?.('my-echoe')) {
    await new Promise(r => setTimeout(r, 1000));
  }
  startTour(stepsFor(screen), { key: seenKeyFor(screen), force: true });
};

/** Resolves once any of the selectors is in the DOM, or false after `timeout` ms. */
const waitForAny = (selectors: string[], timeout: number): Promise<boolean> =>
  new Promise(resolve => {
    const deadline = Date.now() + timeout;
    const poll = () => {
      if (selectors.some(selector => document.querySelector(selector))) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(poll, 100);
    };
    poll();
  });

/**
 * Auto-runs the screen's tour once the screen has painted and its first target
 * exists, and hands back a replay for the "?" button.
 */
export function useTour(screen: ScreenName) {
  current = screen;

  useEffect(() => {
    const steps = stepsFor(screen);
    if (steps.length === 0) return;
    let cancelled = false;
    // A beat for the screen animation and the map's first paint, then wait for
    // a target rather than firing blind. No requestAnimationFrame: a background
    // tab never runs one, and the tour would sit pending until it was looked at.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const selectors = steps.map(item => String(item.element)).filter(Boolean);
      void waitForAny(selectors, 3000).then(async found => {
        if (!found || cancelled) return;
        // World highlights a box tracking the Echoe's WebGL dot. Ease the camera
        // first, then let it settle, or the highlight chases a moving target.
        if (screen === 'world' && window.echoeFocusTourTarget?.('my-echoe')) {
          await new Promise(r => setTimeout(r, 1000));
        }
        if (!cancelled) startTour(stepsFor(screen), { key: seenKeyFor(screen) });
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopTour();
    };
  }, [screen]);

  return useCallback(() => startTour(stepsFor(screen), { key: seenKeyFor(screen), force: true }), [screen]);
}
