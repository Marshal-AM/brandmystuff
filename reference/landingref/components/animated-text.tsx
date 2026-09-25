"use client"

import { motion } from "framer-motion"

interface AnimatedTextProps {
  text: string
  delay?: number
  /** trailing words rendered in the accent colour */
  highlight?: string
  className?: string
}

export function AnimatedText({ text, delay = 0, highlight, className }: AnimatedTextProps) {
  const words = text.split(" ")
  const accentFrom = highlight ? words.length - highlight.split(" ").length : words.length
  let charIndex = 0

  return (
    <motion.span
      className={
        className ??
        "inline-block font-extrabold leading-[0.95] tracking-[-0.05em] text-[clamp(40px,min(7.4vw,11.5vh),112px)]"
      }
      initial="hidden"
      animate="visible"
      style={{ perspective: 400 }}
    >
      {words.map((word, wordIndex) => (
        <span
          key={wordIndex}
          className={wordIndex >= accentFrom ? "text-p" : undefined}
          style={{ display: "inline-block", whiteSpace: "nowrap" }}
        >
          {word.split("").map((char, index) => {
            const currentIndex = charIndex++
            return (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 30, filter: "blur(12px)", rotateX: -45 }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", rotateX: 0 }}
                transition={{
                  duration: 0.6,
                  delay: delay + currentIndex * 0.035,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                style={{ display: "inline-block", transformStyle: "preserve-3d", transformOrigin: "center bottom" }}
              >
                {char}
              </motion.span>
            )
          })}
          {wordIndex < words.length - 1 && " "}
        </span>
      ))}
    </motion.span>
  )
}
