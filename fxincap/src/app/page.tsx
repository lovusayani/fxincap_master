import NavigationHeader from "@/components/sections/navigation-header";
import HeroGoldPromotion from "@/components/sections/hero-gold-promotion";
import TradingToolsSection from "@/components/sections/trading-tools-section";
import CryptoSection from "@/components/sections/crypto-section";
import StrategiesSection from "@/components/sections/strategies-section";
import ProtectionGuarantee from "@/components/sections/protection-guarantee";
import LearnAppSection from "@/components/sections/learn-app-section";
import FinalCtaSection from "@/components/sections/final-cta-section";
import Footer from "@/components/sections/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      <NavigationHeader />
      <main>
        <HeroGoldPromotion />
        <TradingToolsSection />
        <CryptoSection />
        <StrategiesSection />
        <ProtectionGuarantee />
        <LearnAppSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  );
}