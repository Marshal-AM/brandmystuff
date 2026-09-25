"use client";
import { HeroSection } from "@/components/landing/hero-section";
import { TrustStrip } from "@/components/landing/trust-strip";
import { StatsSection } from "@/components/landing/stats-section";
import { ServicesSection } from "@/components/landing/services-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { AgentsSection } from "@/components/landing/agents-section";
import { ProofSection } from "@/components/landing/proof-section";
import { TokeniseSection } from "@/components/landing/tokenise-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FeesSection } from "@/components/landing/fees-section";
import { FAQSection } from "@/components/landing/faq-section";
import { CTASection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

/** The public landing page. The marketplace itself lives at /explore. */
export default function Home() {
  return (
    <div className="landing min-h-screen">
      <HeroSection />
      <TrustStrip />
      <StatsSection />
      <ServicesSection />
      <FeaturesSection />
      <PricingSection />
      <AgentsSection />
      <ProofSection />
      <TokeniseSection />
      <TestimonialsSection />
      <FeesSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  );
}
