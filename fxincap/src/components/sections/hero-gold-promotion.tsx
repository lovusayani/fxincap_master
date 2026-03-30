import { Info } from 'lucide-react';
import React from 'react';

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL?.replace(/\/$/, "") || "https://user. Suimfx.com";

const HeroGoldPromotion = () => {
  return (
    <section className="relative h-screen min-h-[700px] w-full overflow-hidden bg-black text-white">
      <video
        key="hero-video"
        className="absolute inset-0 h-full w-full object-cover"
        poster="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7605a280-297f-425c-8895-09bacf5b13a3-robinhood-com/assets/images/1920_x_988-1.jpg"
        autoPlay
        loop
        muted
        playsInline
      >
        <source
          src="https://videos.ctfassets.net/ilblxxee70tt/19Z1nT89lljUJ9qnvs4IGk/80aa9bf07e9c191de3c75454e79b4070/1920x1080_v3.webm"
          type="video/webm"
        />
        <source
          src="https://videos.ctfassets.net/ilblxxee70tt/J0RCN0dYpaul2zFUXAMAE/0f52c0e82d21cf030ec73df6eb067d27/768x1024_v2.mp4"
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>

      <div className="absolute inset-0 bg-[linear-gradient(105deg,black_20%,rgba(0,0,0,0.4)_50%,rgba(0,0,0,0)_70%)]" aria-hidden="true"></div>

      <div className="relative z-10 flex h-full items-center">
        <div className="container">
          <div className="max-w-xl">
            <h3 className="font-ui text-sm font-medium uppercase tracking-[0.1em] text-[#CCCCCC]">
               Suimfx
            </h3>

            <h1 className="mt-4 font-headline text-[56px] font-light leading-none text-[#d4af86] lg:text-[72px]">
              A Million Reasons to Go Global
            </h1>

            <p className="mt-4 max-w-md text-lg font-normal leading-relaxed text-white">
              Unlock your piece of the forex market with  Suimfx — the world's most advanced trading ecosystem for brokers, traders, and financial businesses.
            </p>

            <div className="mt-6 flex gap-4">
        <a
          href={`${DASHBOARD_URL}/login`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full bg-white px-6 py-[14px] text-sm font-medium text-black transition-transform duration-200 hover:scale-[1.02]"
        >
          Login
        </a>
        <a
          href={`${DASHBOARD_URL}/register`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full border-2 border-white px-6 py-[14px] text-sm font-medium text-white transition-transform duration-200 hover:scale-[1.02] hover:bg-white hover:text-black"
        >
          Sign Up
        </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroGoldPromotion;