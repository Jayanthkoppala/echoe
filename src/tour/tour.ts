import { driver, type Driver, type DriveStep } from 'driver.js';
import './tour.css';

/** One key holds both the per-screen done flags and the global skip. */
const KEY = 'echoe.tour.v1';

type TourState = { screens?: Record<string, boolean>; skipped?: boolean };

const read = (): TourState => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as TourState;
  } catch {
    return {};
  }
};

const write = (state: TourState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: the tour just runs again next time */
  }
};

/** True once this key's tour has run to the end, or the player skipped all tours. */
export const tourSeen = (key: string): boolean => {
  const state = read();
  return Boolean(state.skipped || state.screens?.[key]);
};

const markSeen = (key: string) => {
  const state = read();
  write({ ...state, screens: { ...state.screens, [key]: true } });
};

const skipEverything = () => write({ ...read(), skipped: true });

let active: Driver | null = null;

/** Closes any open tour, e.g. when the player navigates mid-step. */
export const stopTour = () => {
  active?.destroy();
  active = null;
};

// Driver 1.8.0's own escape handling does not fire, so a tour could only be
// left by the X or Skip. Close it here instead.
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && active) stopTour();
});

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs the screen's tour. Steps whose target is not on screen right now are
 * dropped rather than pointing at nothing, and a screen is only auto-toured once.
 */
export function startTour(
  steps: DriveStep[],
  opts: { key: string; force?: boolean },
) {
  if (!opts.force && tourSeen(opts.key)) return;
  // The map anchors are always in the DOM and hidden with a zero box when the
  // Echoe is absent or off-frame, so presence is not enough to highlight.
  const onScreen = (selector: string) => {
    const el = document.querySelector(selector);
    return Boolean(el && el.getBoundingClientRect().width > 0);
  };
  const present = steps.filter(step => !step.element || onScreen(String(step.element)));
  if (present.length === 0) return;
  stopTour();

  const instance = driver({
    steps: present,
    animate: !reducedMotion(),
    // Four of the six screens are single-step; a "1 of 1" counter is noise.
    showProgress: present.length > 1,
    // A one-step tour has nothing to go back to.
    showButtons: present.length > 1 ? ['next', 'previous', 'close'] : ['next', 'close'],
    progressText: '{{current}} of {{total}}',
    allowClose: true,
    overlayColor: '#080b09',
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 14,
    popoverClass: 'echoe-tour',
    popoverOffset: 12,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    onPopoverRender(popover) {
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.innerText = 'Skip tour';
      skip.className = 'tour-skip';
      skip.addEventListener('click', () => {
        skipEverything();
        stopTour();
      });
      // tour.css orders .tour-skip with flex, so DOM position does not matter.
      popover.footer.appendChild(skip);
      // driver.js 1.8.0 leaves `driver-active-element` on every element it has
      // visited, so the ring piles up. This hook runs before the new element is
      // highlighted, so clearing here leaves exactly one ringed element.
      document
        .querySelectorAll('.driver-active-element')
        .forEach(el => el.classList.remove('driver-active-element'));
      // Driver focuses the first focusable in the popover after every render,
      // and that is the close X, so the lime ring lands on dismiss. Moving the
      // X to the end of the wrapper makes Next first. It is positioned
      // absolutely, so this is DOM order only, and it stays tabbable.
      popover.wrapper.appendChild(popover.closeButton);
    },
  });

  active = instance;
  // Marked on start, not on finish: driver.js 1.8.0 never fires the lifecycle
  // hooks passed to driver() (verified in the browser), and every way out of a
  // tour - Done, Skip, Esc, the overlay, navigating away - counts as seen anyway.
  markSeen(opts.key);
  instance.drive();
}
