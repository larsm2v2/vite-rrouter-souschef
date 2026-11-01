import { useMemo } from "react";
import { tokenizeInstruction } from "../../utils/recipeMath";

interface Props {
  text: string;
  stepLabel: string;
  onStartTimer: (label: string, seconds: number) => void;
}

/** Renders instruction text with tappable timers. Text is always rendered as text, never HTML. */
export default function InstructionText({
  text,
  stepLabel,
  onStartTimer,
}: Props) {
  const tokens = useMemo(() => tokenizeInstruction(text), [text]);
  return (
    <>
      {tokens.map((token, index) =>
        token.type === "text" ? (
          <span key={index}>{token.text}</span>
        ) : (
          <button
            key={index}
            type="button"
            className="timer-chip"
            aria-label={`Start ${token.text} timer`}
            onClick={() =>
              onStartTimer(`${stepLabel}: ${token.text}`, token.seconds)
            }
          >
            <span aria-hidden="true">⏱</span> {token.text}
          </button>
        ),
      )}
    </>
  );
}
