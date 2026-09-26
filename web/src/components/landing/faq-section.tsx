"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { EASE, Reveal, SectionHeading } from "./section-kit";

const faqs = [
  {
    question: "What can I list?",
    answer:
      "Anything with a surface people see: laptops, cars, bikes, helmets, backpacks, instrument cases, boards, vans and food trucks, shop windows, walls, stream setups and apparel. Give it a name and a description, and each object can carry up to 20 ad spaces, each its own listing.",
  },
  {
    question: "How is a space scored?",
    answer:
      "A vision model checks your photo is real (taken live through the in-app camera link, no AI or stock images, the close-up really belongs to the object) and brand-safe, then grades the space on 11 criteria such as size, legibility, surface and durability. You get a score from 0 to 100, a grade, and the evidence behind it. Spaces below 40 aren't listed, and you get tips for a better retake.",
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
];

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="px-6 py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16">
          <SectionHeading kicker="FAQ" title="Questions, answered" sub="Anything else? Message us from the app and a human will reply." />
        </div>
        <div className="space-y-3">
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={faq.question} delay={i * 0.04}>
                <div className={`rounded-2xl border px-6 transition-colors duration-300 ${isOpen ? "border-p bg-p-50" : "border-border bg-card"}`}>
                  <button className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-bold text-ink" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                    {faq.question}
                    <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-p">
                      <Plus className="h-4 w-4" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }} className="overflow-hidden">
                        <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
