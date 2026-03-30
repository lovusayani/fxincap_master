"use client";

import * as React from "react";
import Link from "next/link";
import { Feather } from "lucide-react";

const SuimfxLogo = () => (
  <Link
    href="/"
    className="flex shrink-0 items-center gap-2"
    aria-label=" Suimfx homepage"
  >
    <img src="/logo/logo_white.png" alt=" Suimfx" className="h-8 md:h-12 w-auto object-contain" />
  </Link>
);

const NavigationHeader = () => {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 bg-black"
      style={{ fontFamily: '"Capsule Sans Text", "Inter", sans-serif' }}
    >
      <div className="mx-auto flex h-full max-w-full items-center justify-between px-8 2xl:px-20">
        <SuimfxLogo />

        <div className="flex items-center justify-end gap-3">
          <a
            href="https://terminal.suimfx.com/login"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-white bg-transparent px-6 text-base font-medium text-white transition-colors hover:bg-white hover:text-black"
          >
            Log in
          </a>
          <a
            href="https://terminal.suimfx.com/register"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center justify-center whitespace-nowrap rounded-full bg-[#d4ff00] px-6 text-base font-medium text-black transition-colors hover:bg-[#c1ff00]"
          >
            Sign up
          </a>
        </div>
      </div>
    </header>
  );
};

export default NavigationHeader;
