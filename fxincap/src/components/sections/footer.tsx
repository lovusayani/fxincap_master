"use client";

import React from "react";

// Custom SVG icons for pixel-perfect replication
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    height="24"
    width="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path
      d="m20.9 5.3-2.1.8c.4-.2.8-.6.9-1.1-.3.2-.7.4-1.1.5C18.1 4.9 17.3 4.5 16.5 4.5c-1.7 0-3 1.3-3 3 0 .2.1.5.1.7-2.5-.2-5-1.4-6.6-3.4-.3.5-.4 1.1-.4 1.7 0 1 .5 1.9 1.3 2.5-.5 0-1-.2-1.4-.4v.1c0 1.4 1 2.6 2.4 2.9-.3.1-.6.1-.8.1-.2 0-.4 0-.6-.1.4 1.2 1.4 2 2.7 2-1 .8-2.3 1.3-3.7 1.3-.2 0-.5 0-.7-.1 1.3.9 3 1.4 4.7 1.4 5.7 0 8.8-4.8 8.8-8.9v-.4c.6-.4 1.1-.9 1.5-1.6-.5.2-1.1.4-1.7.5.7-.4 1.1-1 1.3-1.7z"
      fill="currentColor"
      stroke="none"
    ></path>
  </svg>
);

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    height="20"
    width="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path d="M10 5.4a4.6 4.6 0 100 9.2 4.6 4.6 0 000-9.2zM10 13a3 3 0 110-6 3 3 0 010 6zm5.2-7.8a1.1 1.1 0 11-2.2 0 1.1 1.1 0 012.2 0zM10 0C4.5 0 0 4.5 0 10s4.5 10 10 10 10-4.5 10-10S15.5 0 10 0zm6.6 10a6.6 6.6 0 11-13.2 0 6.6 6.6 0 0113.2 0z"></path>
  </svg>
);

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    height="20"
    width="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path d="M18.8 0H1.2C.5 0 0 .5 0 1.2v17.6c0 .7.5 1.2 1.2 1.2h17.6c.7 0 1.2-.5 1.2-1.2V1.2C20 .5 19.5 0 18.8 0zM5.9 16.9H3V7.5h2.9v9.4zM4.4 6.3c-.9 0-1.7-.7-1.7-1.7s.7-1.7 1.7-1.7 1.7.7 1.7 1.7-.8 1.7-1.7 1.7zm12.5 10.6h-2.9V12c0-1.2-.4-2-1.5-2-.8 0-1.3.5-1.5 1-.1.2-.1.4-.1.7v5.2H8.1s0-8.5.1-9.4H11v1.3c.4-.6 1-1.5 2.5-1.5 1.8 0 3.1 1.2 3.1 3.7l.1 5.9h.1z"></path>
  </svg>
);

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    height="20"
    width="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path d="M12.92 5.05A3.59 3.59 0 0010.53 4A3.59 3.59 0 007.13 7.4v5.33A3.59 3.59 0 0010.53 16a3.59 3.59 0 003.4-3.4h-2.4a.1.1 0 000 .1 1.25 1.25 0 01-1.1 1.1 1.25 1.25 0 01-1.2-1.2v-5.2h2.29a.1.1 0 00.1-.1 3.5 3.5 0 00-.8-2.65 1.15 1.15 0 01.9-.55h.2v2.29a.1.1 0 00.1.1h2.29a.1.1 0 00.1-.1v-2.3z"></path>
  </svg>
);

const YoutubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    height="20"
    width="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path d="M10 1.9c-4.4 0-8.1 3.6-8.1 8.1s3.6 8.1 8.1 8.1 8.1-3.6 8.1-8.1-3.7-8.1-8.1-8.1zm4.6 8.7-6.2 3.3c-.2.1-.4 0-.4-.2V7c0-.2.2-.4.4-.2l6.2 3.3c.3.1.3.4 0 .6z"></path>
  </svg>
);

const PrivacyChoicesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="25"
    height="12"
    viewBox="0 0 25 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12.308 11.25a.75.75 0 01-.5-1.268l4.027-3.784a.75.75 0 011.002 1.12l-4.027 3.783a.75.75 0 01-.502.15z"
      fill="currentColor"
    ></path>
    <path
      d="M6.205 11.25a.75.75 0 01-.53-1.28L9.7 5.942a.75.75 0 111.06 1.06l-4.027 4.028a.747.747 0 01-.528.22z"
      fill="currentColor"
    ></path>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M24.085 6c0 3.16-2.502 4.755-6.077 5.75a.75.75 0 01-.659-1.428c2.936-.82 4.236-2.028 4.236-4.322 0-2.427-1.12-3.8-3.921-3.8h-1.84a.75.75 0 010-1.5h1.84c3.92 0 5.421 2.3 5.421 5.3zM1.415 6C1.415 2.9 2.915.6 6.835.6h1.84a.75.75 0 110 1.5h-1.84c-2.8 0-3.921 1.373-3.921 3.8 0 2.294 1.3 3.502 4.236 4.322a.75.75 0 11.659 1.428C3.917 10.755 1.415 9.16 1.415 6z"
      fill="currentColor"
    ></path>
  </svg>
);

const productLinks = [
  { name: "Invest", href: "#" },
  { name: "Strategies", href: "#" },
  { name: "Trading", href: "#" },
  { name: "Retirement", href: "#" },
  { name: "Gold", href: "#" },
  { name: "Crypto", href: "#" },
  { name: "Legend", href: "#" },
  { name: "Options", href: "#" },
  { name: "Futures", href: "#" },
  { name: "Banking", href: "#" },
  { name: "Credit Card", href: "#" },
  { name: "Social", href: "#" },
  { name: "Ventures", href: "#" },
  { name: "Learn", href: "#" },
  { name: "Snacks", href: "#" },
];

const companyLinks = [
  { name: "About us", href: "#" },
  { name: "Blog", href: "#" },
  { name: "Partner With Us", href: "#" },
  { name: "Affiliates", href: "#" },
  { name: "Press", href: "#" },
  { name: "Careers", href: "#" },
  { name: "Commitments", href: "#" },
  { name: "Investor Relations", href: "#" },
  { name: "Support", href: "#" },
  { name: "ESG", href: "#" },
  { name: "Investor Index", href: "#" },
  { name: " Suimfx Merch", href: "#" },
];

const legalLinks = [
  { name: "Terms & Conditions", href: "#" },
  { name: "Disclosures", href: "#" },
  { name: "Privacy Statements", href: "#" },
  { name: "Law Enforcement Requests", href: "#" },
];

export default function Footer() {
  return (
    <footer className="bg-black text-white pt-16 pb-12 font-body">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 lg:px-20">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-8 lg:gap-10">
          <div className="flex flex-col sm:flex-row gap-x-8 gap-y-4">
            <a
              href="#"
              className="text-sm font-medium leading-tight hover:underline"
            >
              Customer Relationship Summaries
            </a>
            <a
              href="#"
              className="text-sm font-medium leading-tight hover:underline"
            >
              FINRA's BrokerCheck
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-normal">Follow us on</span>
            <ul className="flex items-center gap-4">
              <li>
                <a
                  href="#"
                  aria-label=" Suimfx on Twitter"
                  className="text-white hover:opacity-75 transition-opacity"
                >
                  <TwitterIcon />
                </a>
              </li>
              <li>
                <a
                  href="#"
                  aria-label=" Suimfx on Instagram"
                  className="text-white hover:opacity-75 transition-opacity"
                >
                  <InstagramIcon />
                </a>
              </li>
              <li>
                <a
                  href="#"
                  aria-label=" Suimfx on LinkedIn"
                  className="text-white hover:opacity-75 transition-opacity"
                >
                  <LinkedinIcon />
                </a>
              </li>
              <li>
                <a
                  href="#"
                  aria-label=" Suimfx on TikTok"
                  className="text-white hover:opacity-75 transition-opacity"
                >
                  <TikTokIcon />
                </a>
              </li>
              <li>
                <a
                  href="#"
                  aria-label=" Suimfx on Youtube"
                  className="text-white hover:opacity-75 transition-opacity"
                >
                  <YoutubeIcon />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 lg:mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          <div>
            <h3 className="text-sm font-medium mb-4">Product</h3>
            <ul className="space-y-4">
              {productLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm font-normal leading-snug hover:underline"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-4">Company</h3>
            <ul className="space-y-4">
              {companyLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm font-normal leading-snug hover:underline"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-4">Legal & Regulatory</h3>
            <ul className="space-y-4">
              {legalLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-sm font-normal leading-snug hover:underline"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
              <li>
                <a href="#" className="flex items-center gap-2 hover:underline">
                  <span className="text-sm font-normal leading-snug">
                    Your Privacy Choices
                  </span>
                  <PrivacyChoicesIcon />
                </a>
              </li>
            </ul>
          </div>
          <div className="text-xs leading-[1.4] space-y-4 md:col-span-2 lg:col-span-1">
            <p className="text-sm font-medium mb-4">
              © 2025 Suimfx. All Rights Reserved.
            </p>
            <p>
              {" "}
              Suimfx is a UK-based fintech company providing forex trading
              platforms, brokerage solutions, and white-label services globally.
            </p>
          </div>
        </div>

        <div
          className="hidden lg:block h-50 overflow-hidden mt-10"
          aria-hidden="true"
        >
          <p className="font-headline font-medium text-[200px] leading-[0.7]">
            {" "}
            Suimfx
          </p>
        </div>

        <div className="mt-8 flex flex-col md:flex-row justify-between items-center text-xs gap-4">
          <p>© 2025 Suimfx. All rights reserved.</p>
          <a
            href="https://wa.me/919238822465?text=Hello,%20I%20would%20like%20to%20know%20more%20about%20 Suimfx%20trading%20platform"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-[#d4ff00] transition-colors font-medium"
          >
            For more details contact
          </a>
        </div>
      </div>
    </footer>
  );
}
