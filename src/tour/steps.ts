import type { DriveStep } from 'driver.js';
import type { ScreenName } from '../state/types';

/**
 * The tour, transcribed from tour-script.md v3 (ids, targets, sides) and
 * tour-copy.md v3 (text). Nine steps, six screens: only what a first-timer
 * cannot read off a label.
 */
const step = (
  target: string,
  title: string,
  description: string,
  side: 'top' | 'bottom' | 'left' | 'right',
  align: 'start' | 'center' | 'end',
  popoverClass?: string,
): DriveStep => ({
  element: `[data-tour="${target}"]`,
  popover: { title, description, side, align, popoverClass },
});

const REVIEW_LIVE = step(
  'review-header',
  'It is talking now',
  'Live means the talk is happening as you watch. New lines land as they are spoken.',
  'bottom',
  'start',
);

const REVIEW_REVEAL = step(
  'review-reveal',
  'Reveal is mutual',
  'Nothing shows until you both tap it. Then each of you sees the other’s details.',
  'top',
  'center',
);

const SCREENS: Partial<Record<ScreenName, DriveStep[]>> = {
  connect: [
    step(
      'connect-safety',
      'What it can do',
      'It reads your repo and writes text. It never edits or runs your code. The list below ticks as each piece lands.',
      'bottom',
      'start',
    ),
  ],
  events: [
    step(
      'events-card',
      'What joining does',
      'Your Echoe talks to everyone already in the room, up to three minutes each.',
      'top',
      'center',
    ),
  ],
  joinEvent: [
    step(
      'joinevent-building',
      'Every talk opens here',
      'Your Echoe leads with this at the event and asks everyone else the same.',
      'bottom',
      'start',
    ),
    step(
      'joinevent-links',
      'Links it never sees',
      'These stay private. They show only when you and one other person both tap Reveal.',
      'top',
      'start',
    ),
  ],
  summary: [
    step(
      'summary-score',
      'The match score',
      'How well they answered what you asked for, scored across several rated parts and blended with the raw match.',
      'bottom',
      'center',
    ),
    step(
      'summary-corrective',
      'What yours got wrong',
      'This scores your own Echoe and lists what it should have said differently.',
      'top',
      'start',
    ),
  ],
  world: [
    step(
      'my-echoe',
      'That is your Echoe',
      'Moving on real Bengaluru roads. Start sets who it looks for and what you reveal.',
      'top',
      'center',
      'echoe-tour echoe-tour--map',
    ),
  ],
};

/**
 * Review is two tours under two flags: a live talk explains the live view, a
 * closed one explains Reveal. One flag would hide Reveal forever after a first
 * visit during a live talk. The reveal panel only renders once the talk closes,
 * so its presence is the state test.
 */
const reviewIsClosed = () => Boolean(document.querySelector('[data-tour="review-reveal"]'));

export const stepsFor = (screen: ScreenName): DriveStep[] =>
  screen === 'review' ? (reviewIsClosed() ? [REVIEW_REVEAL] : [REVIEW_LIVE]) : SCREENS[screen] ?? [];

/** One seen-flag per screen, except Review's two. */
export const seenKeyFor = (screen: ScreenName): string =>
  screen === 'review' ? (reviewIsClosed() ? 'review-closed' : 'review-live') : screen;
