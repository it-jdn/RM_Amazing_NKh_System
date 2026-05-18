"use client";

type Props = {
  message: string;
  compact?: boolean;
  className?: string;
};

/** Spinner + message for intake data preload states */
export function IntakeLoadPanel({ message, compact, className = "" }: Props) {
  return (
    <div
      className={`intake-load-panel${compact ? " intake-load-panel--compact" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="intake-load-panel__spinner" aria-hidden />
      <span className="intake-load-panel__text">{message}</span>
    </div>
  );
}
