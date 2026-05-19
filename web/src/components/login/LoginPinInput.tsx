"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

type Props = {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  pinError?: boolean;
  "aria-label": string;
  "aria-describedby"?: string;
};

/** PIN field with large ● bullets (overlay) and transparent digits for caret alignment */
export const LoginPinInput = forwardRef<HTMLInputElement, Props>(function LoginPinInput(
  {
    id,
    value,
    onChange,
    disabled,
    pinError,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
  },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  return (
    <div
      className={`pin-input-shell${pinError ? " pin-input-shell--error" : ""}${disabled ? " pin-input-shell--disabled" : ""}`}
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
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={pinError || undefined}
        aria-describedby={ariaDescribedBy}
        spellCheck={false}
      />
    </div>
  );
});
