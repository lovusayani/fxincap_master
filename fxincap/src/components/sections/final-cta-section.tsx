import React from 'react';

const FinalCtaSection = () => {
  return (
    <section className="relative overflow-hidden bg-black text-white">
      <div className="absolute inset-0 z-0">
        <video
          className="h-full w-full object-cover"
          src="https://videos.ctfassets.net/ilblxxee70tt/3r1UZhjsj4AexVmCH9hrfH/1e7b93b16249b7ef73025a31d4cfae38/Dotcom_NewGeneration_Animation_WEB.webm"
          autoPlay
          loop
          muted
          playsInline
          aria-label="Join a new generation of investors - sign up"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
      </div>

      <div className="relative z-10 flex min-h-[400px] flex-col items-center justify-center px-6 py-16 text-center md:min-h-[600px]">
        <h1 className="font-headline text-4xl font-light leading-tight text-white md:max-w-[600px] md:text-[64px] md:leading-[1.1]">
          Ready to Launch?
        </h1>
        <p className="mt-6 text-lg text-white/80 md:max-w-[500px]">
          Become a  Suimfx partner today and access the world's most complete forex trading technology — built for performance, trust, and growth.
        </p>
        <div className="h-8" />
        <div className="flex gap-4 flex-wrap justify-center">
          <a
            href="https://dashboard.suimfx.world/login"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-[#D4FF00] px-7 py-[14px] font-ui text-sm font-bold leading-none text-black transition-transform duration-200 ease-out hover:scale-[1.02]"
          >
            <span>Login</span>
          </a>
          <a
            href="https://dashboard.suimfx.world/register"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full border-2 border-white px-7 py-[14px] font-ui text-sm font-bold leading-none text-white transition-transform duration-200 ease-out hover:scale-[1.02] hover:bg-white hover:text-black"
          >
            <span>Sign Up</span>
          </a>
          <a
            href="#"
            className="inline-block rounded-full border-2 border-white px-7 py-[14px] font-ui text-sm font-bold leading-none text-white transition-transform duration-200 ease-out hover:scale-[1.02] hover:bg-white hover:text-black"
          >
            <span>Contact Sales</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default FinalCtaSection;