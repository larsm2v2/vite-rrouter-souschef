import { formatCountdown } from "../../utils/recipeMath";
import { timerRemainingMs, type TimerItem } from "../../hooks/useTimers";

interface Props {
  timers: TimerItem[];
  now: number;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onAddMinute: (id: string) => void;
  onDismiss: (id: string) => void;
}

export default function TimerTray({
  timers,
  now,
  onPause,
  onResume,
  onAddMinute,
  onDismiss,
}: Props) {
  if (timers.length === 0) return null;
  return (
    <section className="timer-tray" aria-label="Timers">
      <ul>
        {timers.map((timer) => {
          const remaining = timerRemainingMs(timer, now) / 1000;
          const running = timer.endsAt !== null;
          return (
            <li
              key={timer.id}
              className={`timer-row ${timer.finished ? "finished" : ""}`}
            >
              <div className="timer-info">
                <span className="timer-label">{timer.label}</span>
                {timer.finished ? (
                  <strong role="alert" className="timer-done">
                    Timer finished
                  </strong>
                ) : (
                  <span
                    className="timer-time"
                    aria-label={`${formatCountdown(remaining)} remaining`}
                  >
                    {formatCountdown(remaining)}
                  </span>
                )}
              </div>
              <div className="timer-actions">
                {!timer.finished &&
                  (running ? (
                    <button
                      type="button"
                      onClick={() => onPause(timer.id)}
                      aria-label={`Pause ${timer.label}`}
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onResume(timer.id)}
                      aria-label={`Resume ${timer.label}`}
                    >
                      Resume
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => onAddMinute(timer.id)}
                  aria-label={`Add one minute to ${timer.label}`}
                >
                  +1 min
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(timer.id)}
                  aria-label={`Dismiss ${timer.label}`}
                >
                  Dismiss
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="timer-note">
        Timers keep time while this page is open. A locked phone may not ring.
      </p>
    </section>
  );
}
