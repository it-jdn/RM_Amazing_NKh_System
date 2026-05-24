"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

type Props = {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  onNonDigit?: () => void;
  disabled?: boolean;
  pinError?: boolean;
  formatError?: boolean;
  "aria-label": string;
  "aria-describedby"?: string;
};

/** PIN field with large ● bullets (overlay) and transparent digits for caret alignment */
export const LoginPinInput = forwardRef<HTMLInputElement, Props>(function LoginPinInput(
  {
    id,
    value,
    onChange,
    onNonDigit,
    disabled,
    pinError,
    formatError,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
  },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  return (
    <div
      className={`pin-input-shell${pinError || formatError ? " pin-input-shell--error" : ""}${disabled ? " pin-input-shell--disabled" : ""}`}
    >
      <div className="pin-input-dots" aria-hidden="true">
        {value ? "●".repeat(value.length) : null}
      </div>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="pin-input pin-input--masked"
        maxLength={8}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          const digits = raw.replace(/\D/g, "");
          if (raw.length > digits.length) onNonDigit?.();
          onChange(digits);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={pinError || formatError || undefined}
        aria-describedby={ariaDescribedBy}
        spellCheck={false}
      />
    </div>
  );
});
