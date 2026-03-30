import Image from "next/image";

const  SuimfxStrategiesLogo = () => (
  <svg
    viewBox="0 0 200 32"
    aria-label=" Suimfx Strategies Logo"
    role="img"
    className="h-8 w-[200px] text-white"
    fill="currentColor"
  >
    <text x="0" y="25" fontSize="20" fontWeight="bold" fontFamily="sans-serif"> Suimfx Strategies</text>
  </svg>
);

const StrategiesSection = () => {
  return (
    <section className="relative overflow-hidden bg-[#121A2A]">
      <div className="absolute inset-0">
        <Image
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7605a280-297f-425c-8895-09bacf5b13a3-robinhood-com/assets/images/RH25_Strategiespromo_wide_homepage_hero-4.jpeg"
          alt="Phone mockup showing  Suimfx Strategies portfolio allocation"
          layout="fill"
          objectFit="cover"
          objectPosition="center"
          quality={100}
        />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-6 py-20 sm:px-10 lg:px-16 xl:px-20">
        <div className="grid lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="max-w-[470px] text-center lg:text-left mx-auto lg:mx-0">
              <div className="flex justify-center lg:justify-start mb-6">
                < SuimfxStrategiesLogo />
              </div>
              <h1 className="font-headline text-[40px] leading-[1.1] md:text-5xl md:leading-[1.1] text-text-primary">
                Simple Pricing
              </h1>
              <div className="mt-6 space-y-4">
                <p className="text-lg leading-relaxed text-text-secondary">
                  $5,000 – One-time setup for complete white-label platform
                </p>
                <p className="text-lg leading-relaxed text-text-secondary">
                  $1,200 – Optional for major customizations or extra features
                </p>
                <p className="text-sm text-text-secondary">
                  Includes full source code, lifetime license, and deployment on your server.
                </p>
              </div>
              <div className="mt-8">
                <p className="text-lg leading-relaxed text-text-secondary mb-4">
                  Your Forex Business, Elevated
                </p>
                <p className="text-sm text-text-secondary mb-4">
                   Suimfx empowers financial startups, trading educators, and fintech entrepreneurs to launch their own branded trading platforms instantly — with zero coding and maximum control.
                </p>
                <p className="text-sm text-text-secondary">
                  Join hundreds of businesses already powered by  Suimfx technology.
                </p>
              </div>
            </div>
          </div>
          <div className="hidden lg:block"></div>
        </div>

        <div className="mt-16 sm:mt-20">
          <div className="bg-black/40 rounded-lg p-6 max-w-2xl">
            <h3 className="text-lg font-medium mb-4">Why  Suimfx</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li>• Real-time trading data and AI analytics</li>
              <li>• 1000x leverage in forex and gold</li>
              <li>• Multi currency payment gateway</li>
              <li>• Secure architecture and high uptime servers</li>
              <li>• Scalable infrastructure for global brokers</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StrategiesSection;