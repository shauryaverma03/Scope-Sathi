import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ShieldCheck, X, Compass } from "lucide-react";

function stored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
const steps = [
  [
    "A place for shared understanding",
    "ScopeSathi keeps your agreed requirements, incoming requests and decisions together. Start by creating a project for your client or team.",
    "overview",
  ],
  [
    "Agree on what you’re building",
    "In Approved scope, paste a brief or upload a text PDF. Review the extracted requirements and explicitly approve your first baseline.",
    "baseline",
  ],
  [
    "Give every request a proper review",
    "Paste a client message into Change requests. Compare it with the baseline, edit the proposal and resolve open questions. Manual review works even without live AI.",
    "requests",
  ],
  [
    "See what changes for your team",
    "Approval creates a new scope version and flags affected tasks. In Tasks & impact, review those tasks before continuing work.",
    "tasks",
  ],
  [
    "Keep decisions traceable",
    "Decision history records who approved what and why. Project settings lets the owner grant viewer, editor or reviewer access. You can replay this tour anytime.",
    "history",
  ],
];
export function Tour({
  close,
  navigate,
}: {
  close: () => void;
  navigate?: (tab: string) => void;
}) {
  const [step, setStep] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, []);
  function finish() {
    try {
      sessionStorage.setItem("scope-tour-seen", "yes");
      if (stored("scope-preferences") === "remember")
        localStorage.setItem("scope-tour-seen", "yes");
    } catch {}
    close();
  }
  return (
    <div
      className="tour-backdrop"
      onKeyDown={(e) => {
        if (e.key === "Escape") finish();
        if (e.key === "Tab") {
          const items = box.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          );
          if (!items?.length) return;
          const first = items[0],
            last = items[items.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === box.current)
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
      <div
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        ref={box}
      >
        <button
          className="icon-button tour-close"
          aria-label="Close tour"
          onClick={finish}
        >
          <X size={20} />
        </button>
        <div className="tour-symbol">
          <Compass size={32} />
        </div>
        <p className="eyebrow">
          YOUR QUICK START · {step + 1} OF {steps.length}
        </p>
        <h2 id="tour-title">{steps[step][0]}</h2>
        <p>{steps[step][1]}</p>
        <div
          className="tour-dots"
          aria-label={`Step ${step + 1} of ${steps.length}`}
        >
          {steps.map((_, i) => (
            <span key={i} className={i === step ? "active" : ""} />
          ))}
        </div>
        <div className="row-between">
          <button
            className="button"
            disabled={step === 0}
            onClick={() => {
              setStep(step - 1);
              navigate?.(steps[step - 1][2]);
            }}
          >
            Back
          </button>
          <button
            className="button primary"
            onClick={() => {
              if (step === steps.length - 1) finish();
              else {
                setStep(step + 1);
                navigate?.(steps[step + 1][2]);
              }
            }}
          >
            {step === steps.length - 1 ? "Start building" : "Next"}{" "}
            <ArrowRight size={16} />
          </button>
        </div>
        <button className="text-button" onClick={finish}>
          Skip tour for now
        </button>
      </div>
    </div>
  );
}
export function FirstVisit({ navigate }: { navigate?: (tab: string) => void }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(() => !stored("scope-preferences"));
  useEffect(() => {
    let seen = false;
    try {
      seen =
        sessionStorage.getItem("scope-tour-seen") === "yes" ||
        stored("scope-tour-seen") === "yes";
    } catch {}
    if (!seen) setOpen(true);
  }, []);
  function preference(remember: boolean) {
    try {
      localStorage.setItem(
        "scope-preferences",
        remember ? "remember" : "essential",
      );
      if (!remember) localStorage.removeItem("scope-tour-seen");
      else if (sessionStorage.getItem("scope-tour-seen"))
        localStorage.setItem("scope-tour-seen", "yes");
    } catch {}
    setNotice(false);
  }
  return (
    <>
      <button className="button tour-launch" onClick={() => setOpen(true)}>
        <Compass size={16} /> Website tour
      </button>
      <button
        className="text-button preference-launch"
        onClick={() => setNotice(true)}
      >
        Privacy preferences
      </button>
      {notice && !open && (
        <section
          className="preference-notice"
          aria-label="Browser storage preferences"
        >
          <strong>Your browser, your choice</strong>
          <p>
            Firebase uses browser storage to keep you signed in. We use session
            storage to avoid repeating this tour in the same tab. Optionally
            remember tour completion across visits. No advertising or analytics
            cookies are used.
          </p>
          <div>
            <button className="button" onClick={() => preference(false)}>
              Essential only
            </button>
            <button className="button primary" onClick={() => preference(true)}>
              Remember my tour
            </button>
          </div>
        </section>
      )}
      {open && <Tour navigate={navigate} close={() => setOpen(false)} />}
    </>
  );
}
export function Home({
  login,
  busy,
  error,
}: {
  login: (remember: boolean) => void;
  busy: boolean;
  error: string;
}) {
  const [auth, setAuth] = useState<"signin" | "signup" | null>(null),
    [tour, setTour] = useState(false),
    [remember, setRemember] = useState(false);
  return (
    <div className="public-home">
      <FirstVisit />
      <header className="home-nav">
        <a href="#" className="home-logo">
          ◇ scopesathi<span>✧</span>
        </a>
        <nav>
          <a href="#features">Features</a>
          <button className="text-button" onClick={() => setTour(true)}>
            Take a tour
          </button>
          <button className="button" onClick={() => setAuth("signin")}>
            Sign in
          </button>
          <button className="button primary" onClick={() => setAuth("signup")}>
            Sign up <ArrowRight size={16} />
          </button>
        </nav>
      </header>
      <main>
        <section className="home-hero">
          <div>
            <p className="eyebrow">CLARITY BEFORE COMMITMENT</p>
            <h1>
              Great work.
              <br />
              Clear scope.
              <br />
              <em>Fewer surprises.</em>
            </h1>
            <p className="home-lead">
              Turn client conversations into shared understanding. Keep your
              agreed scope protected while your team decides what comes next.
            </p>
            <div className="home-actions">
              <button
                className="button primary"
                onClick={() => setAuth("signup")}
              >
                Create your workspace <ArrowRight size={18} />
              </button>
              <button className="button" onClick={() => setTour(true)}>
                Show me how it works
              </button>
            </div>
            <p className="home-trust">
              <ShieldCheck size={17} /> Human approval, always. Your team stays
              in control.
            </p>
          </div>
          <div className="home-preview">
            <div className="row-between">
              <span className="eyebrow">A CLEARER WAY TO WORK</span>
              <span className="badge">Example</span>
            </div>
            <h2>“Could we add guest checkout?”</h2>
            <div className="preview-block">
              <small>APPROVED SCOPE</small>
              <p>Customers sign in before checkout.</p>
            </div>
            <div className="preview-block proposed">
              <small>PROPOSED CHANGE</small>
              <p>Offer guest checkout alongside sign-in.</p>
            </div>
            <div className="home-check">
              <Check size={18} /> Review the evidence
            </div>
            <div className="home-check">
              <Check size={18} /> Resolve open questions
            </div>
            <div className="home-check">
              <ShieldCheck size={18} /> Approve before changing scope
            </div>
            <p className="helper">
              Illustrative workflow — no change is applied automatically.
            </p>
          </div>
        </section>
        <section id="features" className="home-features">
          <p className="eyebrow">FROM FIRST BRIEF TO FINAL DECISION</p>
          <h2>One place to keep everyone aligned.</h2>
          <div>
            {[
              [
                "01",
                "Agree on a baseline",
                "Capture requirements from a brief and approve the scope together.",
              ],
              [
                "02",
                "Review every change",
                "Keep the original request, source evidence and proposed wording side by side.",
              ],
              [
                "03",
                "Move forward with confidence",
                "Track decisions, scope versions and tasks that need another look.",
              ],
            ].map(([n, h, p]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{h}</h3>
                <p>{p}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="home-features home-workflow">
          <p className="eyebrow">THE COMPLETE WORKFLOW</p>
          <h2>From the client’s brief to your team’s next step.</h2>
          <ol className="workflow-path">
            {[
              "Client brief",
              "Reviewed baseline",
              "Incoming request",
              "Requirement comparison",
              "Human approval",
              "Task impact",
            ].map((step, i) => (
              <li key={step}>
                <span>{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div>
            {[
              [
                "01",
                "Client intake & documents",
                "Capture goals, users, features, deliverables, constraints, acceptance criteria and excluded work. Paste a brief or upload a text PDF.",
              ],
              [
                "02",
                "Evidence-based review",
                "See original wording, exact request quotes and proposed requirements together. Live Gemini suggestions require configuration; manual review is always available.",
              ],
              [
                "03",
                "Revision rounds",
                "Group related client requests, track your included allowance, and record a separate agreement for additional rounds.",
              ],
              [
                "04",
                "Roles & approval",
                "Owners manage access. Editors prepare work, reviewers decide, and viewers follow progress. Scope changes need human approval.",
              ],
              [
                "05",
                "Versions & history",
                "Compare preserved baseline versions and follow reviewer notes, decisions and task impact over time.",
              ],
              [
                "06",
                "Exports & storage",
                "Export scope, history and tasks. Firestore connections are verified before showing connected; setup credentials are required.",
              ],
            ].map(([n, h, p]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{h}</h3>
                <p>{p}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="home-footer">
        <span>ScopeSathi · Clarity before commitment</span>
        <span>
          No advertising or analytics cookies. Sign-in uses essential browser
          storage.
        </span>
      </footer>
      {auth && (
        <div className="tour-backdrop">
          <section
            className="tour-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setAuth(null);
              if (e.key === "Tab") {
                const items = e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled), input:not(:disabled)",
                );
                const first = items[0],
                  last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <button
              autoFocus
              className="icon-button tour-close"
              aria-label="Close sign-in"
              disabled={busy}
              onClick={() => setAuth(null)}
            >
              <X size={20} />
            </button>
            <p className="eyebrow">YOUR SCOPESATHI WORKSPACE</p>
            <h2 id="auth-title">
              {auth === "signup"
                ? "Start with shared clarity."
                : "Welcome back."}
            </h2>
            <p>
              {auth === "signup"
                ? "Create your account securely with Google. Your first sign-in creates your Firebase account."
                : "Sign in with the Google account you use for your projects."}
            </p>
            <label className="remember-choice">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Keep me signed in on this browser
            </label>
            <button
              className="button primary full"
              disabled={busy}
              onClick={() => login(remember)}
            >
              {busy
                ? "Opening Google…"
                : auth === "signup"
                  ? "Sign up with Google"
                  : "Sign in with Google"}{" "}
              <ArrowRight size={16} />
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <p className="helper">
              Unchecked: your sign-in lasts for this browser session. No
              separate password is needed.
            </p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setAuth(auth === "signup" ? "signin" : "signup")}
            >
              {auth === "signup"
                ? "Already have an account? Sign in"
                : "New here? Sign up"}
            </button>
          </section>
        </div>
      )}
      {tour && <Tour close={() => setTour(false)} />}
    </div>
  );
}
