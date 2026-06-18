"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface NumberInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "value" | "onChange" | "type" | "min" | "max" | "prefix" | "suffix"
  > {
  /** Current numeric value (null/undefined renders an empty field). */
  value: number | null | undefined;
  /** Called with the parsed numeric value (or null when the field is empty). */
  onValueChange: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Number of decimal places to allow. 0 = integers only (default). */
  decimals?: number;
  /** Static label rendered inside the field, after the number (e.g. "฿", "คน"). */
  suffix?: React.ReactNode;
  /** Static label rendered inside the field, before the number. */
  prefix?: React.ReactNode;
}

// Group the integer part with thousands separators, keep the decimal part raw.
function groupThousands(raw: string): string {
  if (raw === "" || raw === "-") return raw;
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPart, decPart] = unsigned.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = decPart !== undefined ? `${grouped}.${decPart}` : grouped;
  return negative ? `-${out}` : out;
}

// Keep only digits, a single leading "-", and (when allowed) one "." with up to
// `decimals` fractional digits.
function sanitize(input: string, decimals: number): string {
  let s = input.replace(/[^\d.-]/g, "");
  // single leading minus
  const negative = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (decimals <= 0) {
    s = s.replace(/\./g, "");
  } else {
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
      const intPart = s.slice(0, firstDot);
      const decPart = s.slice(firstDot + 1).replace(/\./g, "").slice(0, decimals);
      s = `${intPart}.${decPart}`;
    }
  }
  return negative ? `-${s}` : s;
}

function toNumber(raw: string): number | null {
  if (raw === "" || raw === "-" || raw === ".") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/**
 * Text input that shows numbers with thousands separators (1,234,567) while
 * storing a real `number`. Use for any quantity/amount field. For money, prefer
 * <CurrencyInput> which adds the ฿ suffix + 2 decimals.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    { value, onValueChange, min, max, decimals = 0, suffix, prefix, className, disabled, readOnly, ...props },
    ref
  ) => {
    // Raw (ungrouped) string the user is editing, e.g. "1234.5".
    const [raw, setRaw] = React.useState<string>(
      value === null || value === undefined ? "" : String(value)
    );
    const [focused, setFocused] = React.useState(false);

    // Sync external value → display when not actively editing.
    React.useEffect(() => {
      if (focused) return;
      const next = value === null || value === undefined ? "" : String(value);
      if (toNumber(raw) !== toNumber(next)) setRaw(next);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, focused]);

    const clamp = (n: number | null): number | null => {
      if (n === null) return null;
      let v = n;
      if (typeof min === "number") v = Math.max(min, v);
      if (typeof max === "number") v = Math.min(max, v);
      return v;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = sanitize(e.target.value, decimals);
      setRaw(next);
      onValueChange(toNumber(next));
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      const clamped = clamp(toNumber(raw));
      setRaw(clamped === null ? "" : String(clamped));
      onValueChange(clamped);
      props.onBlur?.(e);
    };

    return (
      <div
        className={cn(
          "border-input flex h-10 w-full min-w-0 items-center rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow]",
          "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
          (disabled || readOnly) && "pointer-events-none opacity-50",
          readOnly && "bg-gray-50 opacity-100",
          className
        )}
      >
        {prefix != null && <span className="mr-1.5 shrink-0 text-muted-foreground">{prefix}</span>}
        <input
          ref={ref}
          type="text"
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          data-slot="number-input"
          className="w-full min-w-0 flex-1 bg-transparent text-right tabular-nums outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          value={groupThousands(raw)}
          onChange={handleChange}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={handleBlur}
          disabled={disabled}
          readOnly={readOnly}
          {...props}
        />
        {suffix != null && <span className="ml-1.5 shrink-0 text-muted-foreground">{suffix}</span>}
      </div>
    );
  }
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
