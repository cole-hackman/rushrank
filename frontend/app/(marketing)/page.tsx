import { Hero } from "@/components/marketing/Hero";
import { SwipeDemo } from "@/components/marketing/SwipeDemo";
import { PnmCardShowcase } from "@/components/marketing/PnmCardShowcase";
import { FeatureGrid } from "@/components/marketing/FeatureGrid";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { SocialProof } from "@/components/marketing/SocialProof";
import { CtaStrip } from "@/components/marketing/CtaStrip";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <SwipeDemo />
      <PnmCardShowcase />
      <FeatureGrid />
      <HowItWorks />
      <SocialProof />
      <CtaStrip />
    </>
  );
}
