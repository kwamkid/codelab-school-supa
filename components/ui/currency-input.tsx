"use client";

import * as React from "react";
import { NumberInput, type NumberInputProps } from "./number-input";

export interface CurrencyInputProps
  extends Omit<NumberInputProps, "suffix" | "prefix" | "decimals"> {
  /** Currency symbol shown as a postfix. Defaults to ฿ (THB). */
  symbol?: React.ReactNode;
  /** Allow satang? Defaults to 0 decimals (whole baht), matching most pricing. */
  decimals?: number;
}

/**
 * Money input: thousands separators + a trailing currency symbol (฿ by default),
 * e.g. "139,900 ฿". Stores a real number. Built on <NumberInput>.
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ symbol = "฿", decimals = 0, min = 0, ...props }, ref) => {
    return (
      <NumberInput
        ref={ref}
        min={min}
        decimals={decimals}
        suffix={<span className="font-medium">{symbol}</span>}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
