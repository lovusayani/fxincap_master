"use client";

import React, { useEffect, useState } from "react";
import { defaultTradeUrl, deriveTradeUrl } from "@/lib/trade-url";

/**
 * Anchor pointing at the trading platform for the current domain.
 *
 * Renders an SSR-safe default first, then resolves the real host after
 * hydration — so the same build works on any domain without a rebuild.
 */
export function TradeLink({
  path = "",
  className,
  children,
  ariaLabel,
}: {
  path?: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const [base, setBase] = useState<string>(defaultTradeUrl());

  useEffect(() => {
    setBase(deriveTradeUrl(window.location.hostname, window.location.protocol));
  }, []);

  return (
    <a
      href={`${base}${path}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}
