import React, { useEffect, useRef, useState } from "react";
import { WordingDiff } from "./ReviewInsights";

const example = [
  {
    title: "1. Establish the agreement",
    text: "Customers must sign in before checkout. An approved baseline makes this obligation explicit.",
    note: "In your own project, review the extracted clauses and approve version 1.",
  },
  {
    title: "2. Receive a client request",
    text: "Please allow guest checkout alongside sign-in. Send guests a tracking link.",
    note: "A request proposes work; it does not authorize a change.",
  },
  {
    title: "3. Compare evidence",
    text: "Guest checkout modifies the sign-in obligation. Both flows must remain in the proposed wording.",
    note: "Ask how guest tracking links expire. An unresolved question blocks approval.",
  },
  {
    title: "4. Confirm and decide",
    text: "After confirming tracking-link details, the reviewer checks the proposal. If an extra paid round applies, the designated client must first accept a current quote.",
    note: "Client consent and reviewer approval are distinct actions.",
  },
  {
    title: "5. Preserve the outcome",
    text: "Approval creates a new baseline version and flags linked checkout work for review. The previous agreement remains available.",
    note: "Task impact does not rewrite tasks or mark implementation complete.",
  },
];
export function ExampleWalkthrough({ close }: { close: () => void }) {
  const [step, setStep] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="tour-backdrop">
      <div
        className="tour-card example-walkthrough"
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Worked example, no live AI calls"
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "Tab") {
            const items = panel.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            );
            if (!items?.length) return;
            const first = items[0],
              last = items[items.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === panel.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <button className="button" onClick={close}>
          Close example
        </button>
        <p className="eyebrow">
          ILLUSTRATIVE EXAMPLE · NO AI CALLS · NO DATA SAVED
        </p>
        <div aria-live="polite">
          <h2>{example[step].title}</h2>
          <p>{example[step].text}</p>
          {step === 2 && (
            <WordingDiff
              before="Customers must sign in before checkout."
              after="Customers may check out as guests or sign in before checkout."
            />
          )}
          <p className="helper">{example[step].note}</p>
        </div>
        <div className="button-row">
          <button
            className="button"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Previous
          </button>
          <span>
            {step + 1} / {example.length}
          </span>
          <button
            className="button primary"
            onClick={() =>
              step === example.length - 1 ? close() : setStep(step + 1)
            }
          >
            {step === example.length - 1 ? "Finish example" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
