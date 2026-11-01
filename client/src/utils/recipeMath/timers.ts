import { NUMBER_PATTERN, toNumber } from "./quantity";

export interface TimerMatch {
  start: number;
  end: number;
  text: string;
  /** Seconds to start the timer at (lower bound for ranges). */
  seconds: number;
  /** Upper bound for ranges like "10-12 minutes". */
  maxSeconds?: number;
}

export type InstructionToken =
  | { type: "text"; text: string }
  | { type: "timer"; text: string; seconds: number; maxSeconds?: number };

const UNIT_SECONDS: [RegExp, number][] = [
  [/^(?:hours?|hrs?)$/i, 3600],
  [/^(?:minutes?|mins?)$/i, 60],
  [/^(?:seconds?|secs?)$/i, 1],
];

const RANGE = String.raw`(?:\s*[-–—]\s*|\s+to\s+)`;
const UNIT_WORD = String.raw`(?:hours?|hrs?|minutes?|mins?|seconds?|secs?)`;
const SEGMENT = String.raw`(${NUMBER_PATTERN})(?:${RANGE}(${NUMBER_PATTERN}))?\s*(${UNIT_WORD})(?![A-Za-z])`;
const COMPOUND_JOINER = String.raw`(?:\s*,?\s*(?:and\s+)?)`;

function unitSeconds(word: string): number {
  for (const [pattern, seconds] of UNIT_SECONDS)
    if (pattern.test(word)) return seconds;
  return 0;
}

/** Find durations in instruction text. Temperatures, sizes and counts never match. */
export function findDurations(text: string): TimerMatch[] {
  const matches: TimerMatch[] = [];
  const segment = new RegExp(SEGMENT, "gi");
  const joiner = new RegExp(`^${COMPOUND_JOINER}`);

  const half = /\bhalf an hour\b/gi;
  let h: RegExpExecArray | null;
  while ((h = half.exec(text))) {
    matches.push({
      start: h.index,
      end: h.index + h[0].length,
      text: h[0],
      seconds: 1800,
    });
  }

  let m: RegExpExecArray | null;
  while ((m = segment.exec(text))) {
    const first = toNumber(m[1]);
    if (first === null || first <= 0) continue;
    const second = m[2] ? toNumber(m[2]) : null;
    const secs = unitSeconds(m[3]);
    let start = m.index;
    let end = m.index + m[0].length;
    let seconds = first * secs;
    const maxSeconds =
      second !== null && second > first ? second * secs : undefined;

    // Compound: "1 hour 30 minutes", "1 hour and 15 minutes"
    if (maxSeconds === undefined) {
      const rest = text.slice(end);
      const j = joiner.exec(rest);
      if (j) {
        const next = new RegExp(`^${SEGMENT}`, "i").exec(
          rest.slice(j[0].length),
        );
        if (next && !next[2]) {
          const nextSecs = unitSeconds(next[3]);
          const nextVal = toNumber(next[1]);
          if (nextVal !== null && nextSecs > 0 && nextSecs < secs) {
            seconds += nextVal * nextSecs;
            end += j[0].length + next[0].length;
          }
        }
      }
    }
    if (matches.some((x) => start < x.end && end > x.start)) continue;
    matches.push({
      start,
      end,
      text: text.slice(start, end),
      seconds: Math.round(seconds),
      maxSeconds: maxSeconds === undefined ? undefined : Math.round(maxSeconds),
    });
    segment.lastIndex = end;
    start = end;
  }
  return matches.sort((a, b) => a.start - b.start);
}

/** Split text into plain text and timer tokens (render as React nodes, never as HTML). */
export function tokenizeInstruction(text: string): InstructionToken[] {
  const found = findDurations(text);
  if (found.length === 0) return [{ type: "text", text }];
  const tokens: InstructionToken[] = [];
  let cursor = 0;
  for (const f of found) {
    if (f.start > cursor)
      tokens.push({ type: "text", text: text.slice(cursor, f.start) });
    tokens.push({
      type: "timer",
      text: f.text,
      seconds: f.seconds,
      maxSeconds: f.maxSeconds,
    });
    cursor = f.end;
  }
  if (cursor < text.length)
    tokens.push({ type: "text", text: text.slice(cursor) });
  return tokens;
}

/** "9:05", "1:02:03" */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours > 0 ? `${hours}:` : ""}${mm}:${String(seconds).padStart(2, "0")}`;
}
