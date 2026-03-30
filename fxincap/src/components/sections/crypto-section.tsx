import Image from "next/image";
import { Info } from "lucide-react";
import { SVGProps } from "react";

const  SuimfxWordmark = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-label=" Suimfx Wordmark"
    role="img"
    viewBox="0 0 120 35"
    fill="currentColor"
    {...props}
  >
    <text x="0" y="25" fontSize="24" fontWeight="bold" fontFamily="sans-serif"> Suimfx</text>
  </svg>
);

const CryptoSection = () => {
    return (
        <section className="relative overflow-hidden bg-black text-white">
            <div className="absolute inset-0 z-0">
                <Image
                    src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7605a280-297f-425c-8895-09bacf5b13a3-robinhood-com/assets/images/web_crypto_hero-3.jpg"
                    alt="Artistic 3D image of metallic chain links on a light blue-gray gradient background"
                    layout="fill"
                    objectFit="cover"
                    objectPosition="center"
                    quality={100}
                />
            </div>
            <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-5">
                <div className="lg:col-span-2">
                    <div className="flex h-full flex-col bg-gradient-to-b from-black/60 to-black/30">
                        <div className="flex-grow px-6 py-16 sm:px-12 lg:pl-20 xl:pl-28 lg:pr-12 lg:py-24">
                            <div className="max-w-md">
                                < SuimfxWordmark className="h-8 w-auto mb-4" />
                                <h1 className="font-headline text-[48px] lg:text-[56px] font-light leading-none mb-6">
                                    White-Label Solutions
                                </h1>
                                <p className="text-lg leading-relaxed mb-6">
                                    Launch your own forex brokerage with  Suimfx White Label — complete with:
                                </p>
                                <ul className="space-y-2 text-sm mb-6">
                                    <li>• Fully branded platform (your name, logo, and domain)</li>
                                    <li>• User & admin dashboards with full database integration</li>
                                    <li>• CRM + KYC + Wallet + Transaction system</li>
                                    <li>• Deposit & withdrawal gateway integration</li>
                                    <li>• WebSocket-based real-time market data streaming</li>
                                    <li>• Mobile & desktop responsiveness</li>
                                    <li>• 24/7 support and maintenance</li>
                                </ul>
                                <p className="text-sm text-[#cccccc] mb-4">
                                    Delivered and deployed directly to your VPS or cloud — ready to go live.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="hidden lg:block lg:col-span-3" />
            </div>
        </section>
    );
};

export default CryptoSection;