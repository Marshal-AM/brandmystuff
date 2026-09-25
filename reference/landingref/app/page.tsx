import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { TrustStrip } from "@/components/trust-strip"
import { StatsSection } from "@/components/stats-section"
import { ServicesSection } from "@/components/services-section"
import { FeaturesSection } from "@/components/features-section"
import { PricingSection } from "@/components/pricing-section"
import { AgentsSection } from "@/components/agents-section"
import { ProofSection } from "@/components/proof-section"
import { TokeniseSection } from "@/components/tokenise-section"
import { TestimonialsSection } from "@/components/testimonials-section"
import { FeesSection } from "@/components/fees-section"
import { FAQSection } from "@/components/faq-section"
import { CTASection } from "@/components/cta-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
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
    </main>
  )
}
