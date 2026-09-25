import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { SectionHeading } from "./section-kit"

const faqs = [
  {
    question: "What can I list?",
    answer:
      "Anything from the catalogue: laptops, cars, motorcycles, bikes, helmets, backpacks, instrument cases, boards, vans and food trucks, shop windows, walls and fences, stream setups and apparel. Each object can have up to 20 ad spaces, and each space is its own listing.",
  },
  {
    question: "How is a space scored?",
    answer:
      "A vision model checks your photo is real (capture code, no AI or stock images, the close-up really belongs to the object) and brand-safe, then grades the space on 11 criteria such as size, legibility, surface and durability. You get a score from 0 to 100, a grade, and the evidence behind it. Spaces below 40 aren't listed, and you get tips for a better retake.",
  },
  {
    question: "When do I get paid?",
    answer:
      "The brand pays the full lease upfront into an escrow on Sui. Each week you snap a proof photo in the app. Once it checks out, that week's payout (88% of the price) lands in your USDC wallet straight away.",
  },
  {
    question: "Do I need a crypto wallet?",
    answer:
      "No. Sign in with Google, Apple, X, email or a passkey and a wallet is created for you, with no seed phrase. You can connect your own Sui wallet if you prefer.",
  },
  {
    question: "What does a brand's AI agent do?",
    answer:
      "Every brand that joins gets its own agent, Scout. It analyses the brand (visual identity, tone of voice, audience and budget), checks every listing on the platform against it, and shortlists the spaces that fit. Once the brand approves the budget, Scout books the spaces and pays in USDC via x402 into escrow on Sui, then tracks every proof photo.",
  },
  {
    question: "What happens if a brand's creative isn't right for me?",
    answer:
      "You approve every creative. You have five days to approve or reject a lease, and you can chat with the brand first. If you reject it or don't answer, the brand is refunded in full.",
  },
  {
    question: "Is tokenisation live?",
    answer:
      "It runs on Sui testnet with test funds and mock legal documents, so you can try the full loop: create an offering, sell units, distribute income, claim and trade. It is not an offer of securities.",
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="px-6 py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16">
          <SectionHeading kicker="FAQ" title="Questions, answered" sub="Anything else? Message us from the app and a human will reply." />
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="rounded-2xl border border-border bg-card px-6 transition-colors data-[state=open]:border-p data-[state=open]:bg-p-50"
            >
              <AccordionTrigger className="py-5 text-left text-base font-bold text-ink hover:no-underline">{faq.question}</AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
