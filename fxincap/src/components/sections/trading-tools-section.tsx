import Image from "next/image";

const TradingToolsSection = () => {
  return (
    <section className="relative bg-gradient-to-b from-[#1a1a1a] to-black text-white">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-20 py-16 lg:py-24">
        <div className="flex flex-col lg:flex-row lg:items-center">
          <div className="lg:w-[55%] lg:pr-12 xl:pr-24">
            <Image
              src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7605a280-297f-425c-8895-09bacf5b13a3-robinhood-com/assets/images/web_homepage_investing_2-2.jpeg"
              alt="A computer monitor displaying complex financial charts and data for trading analysis."
              width={1280}
              height={960}
              className="w-full h-auto"
            />
          </div>
          <div className="lg:w-[45%] mt-12 lg:mt-0">
            <div className="max-w-md mx-auto lg:mx-0 lg:max-w-none">
              <span className="font-body font-medium text-sm text-[#d4ff00]">
                Next-Gen Forex Trading Platform
              </span>
              <h2 className="font-headline text-[40px] text-white font-normal leading-tight mt-6">
                Power your business with  Suimfx's all-in-one trading technology — built for performance, flexibility, and growth.
              </h2>
              <p className="font-body text-muted-foreground text-lg mt-6">
                Trade forex, indices, crypto, gold, and commodities with lightning-fast execution and deep liquidity.
              </p>
              <p className="font-body text-muted-foreground text-sm mt-4">
                Intuitive dashboards. Real-time charts. AI-backed analytics.
              </p>
              <div className="mt-6">
                <p className="font-body text-sm text-white mb-3">Explore Our Platforms:</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• User Dashboard: Modern web and app interface for traders</li>
                  <li>• Admin CRM: Advanced control for brokers to manage users, deposits, and revenue</li>
                  <li>• Database & Hosting: Full backend setup on your server</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </section>
  );
};

export default TradingToolsSection;