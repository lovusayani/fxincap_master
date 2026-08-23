"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  BRANDING_DEFAULTS,
  fetchPlatformBrandingClient,
  type PlatformBranding,
} from "@/lib/platform-branding";

const BrandContext = createContext<PlatformBranding>(BRANDING_DEFAULTS);

/**
 * Supplies the admin-configured app name and logos to the marketing site.
 * Seeded server-side so the correct name is in the first paint, then refreshed
 * on the client so an admin change shows up without a redeploy.
 */
export function BrandProvider({
  initial,
  children,
}: {
  initial?: PlatformBranding;
  children: React.ReactNode;
}) {
  const [branding, setBranding] = useState<PlatformBranding>(initial || BRANDING_DEFAULTS);

  useEffect(() => {
    let disposed = false;
    fetchPlatformBrandingClient().then((next) => {
      if (!disposed) setBranding(next);
    });
    return () => {
      disposed = true;
    };
  }, []);

  return <BrandContext.Provider value={branding}>{children}</BrandContext.Provider>;
}

export const useBranding = () => useContext(BrandContext);

/** Convenience for the many places that only need the display name. */
export const useBrandName = () => useContext(BrandContext).appName;
