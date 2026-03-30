import Image from 'next/image';

const features = [
  {
    iconSrc: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7605a280-297f-425c-8895-09bacf5b13a3-robinhood-com/assets/svgs/illo_secure-1.svg",
    altText: "Multi-factor authentication",
    description: "Multi-factor authentication",
  },
  {
    iconSrc: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7605a280-297f-425c-8895-09bacf5b13a3-robinhood-com/assets/svgs/illo_protect-2.svg",
    altText: "Encrypted transactions",
    description: "Encrypted transactions",
  },
  {
    iconSrc: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7605a280-297f-425c-8895-09bacf5b13a3-robinhood-com/assets/svgs/illo_multi-factor-3.svg",
    altText: "Anti-fraud monitoring",
    description: "Anti-fraud monitoring",
  },
  {
    iconSrc: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7605a280-297f-425c-8895-09bacf5b13a3-robinhood-com/assets/svgs/illo_247-4.svg",
    altText: "24/7 security response",
    description: "24/7 security response",
  },
];

const ProtectionGuarantee = () => {
  return (
    <section className="bg-[#1a1612] text-white py-14 md:py-16 lg:py-24">
      <div className="mx-auto max-w-[1408px] px-6 md:px-12 lg:px-16">
        <div className="text-center">
          <h2 className="font-headline text-[48px] leading-[1.1] text-white">
             Suimfx Protection
          </h2>
          <div className="mt-8">
            <p className="text-lg text-white/80">
              Your data and users are secured with:
            </p>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-6xl">
          <div className="grid grid-cols-1 gap-y-14 md:grid-cols-2 md:gap-x-12 md:gap-y-10 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div key={index} className="mx-auto flex max-w-[250px] flex-col items-center text-center">
                <div className="mb-6">
                  <Image
                    src={feature.iconSrc}
                    alt={feature.altText}
                    width={80}
                    height={80}
                    className="w-20"
                  />
                </div>
                <h5 className="font-body text-base font-normal leading-relaxed text-white">
                  {feature.description}
                </h5>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProtectionGuarantee;