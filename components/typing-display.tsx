"use client"

import { useMemo } from "react"
import type { CharState, GhostCursor } from "@/hooks/use-typing-test"

interface TypingDisplayProps {
  words: string[]
  currentWordIndex: number
  currentCharIndex: number
  getWordCharStates: (wordIndex: number) => CharState[]
  ghostCursor?: GhostCursor | null
  testState: "idle" | "running" | "finished"
}

export function TypingDisplay({
  words,
  currentWordIndex,
  currentCharIndex,
  getWordCharStates,
  ghostCursor,
  testState,
}: TypingDisplayProps) {
  const lineLayout = useMemo(() => {
    const lines: number[][] = []
    const wordToLine: number[] = []

    let line: number[] = []
    let lineLength = 0
    const maxLineLength = 52

    for (let i = 0; i < words.length; i++) {
      const wordLength = words[i].length + 1
      if (line.length > 0 && lineLength + wordLength > maxLineLength) {
        lines.push(line)
        line = []
        lineLength = 0
      }

      line.push(i)
      wordToLine[i] = lines.length
      lineLength += wordLength
    }

    if (line.length > 0) {
      lines.push(line)
    }

    return { lines, wordToLine }
  }, [words])

  const activeLine = lineLayout.wordToLine[currentWordIndex] ?? 0
  const maxTopLine = Math.max(0, lineLayout.lines.length - 3)
  const topVisibleLine = Math.min(maxTopLine, Math.max(0, activeLine - 1))
  const lineHeight = 56
  const translateY = topVisibleLine * lineHeight

  return (
    <div className="relative mx-auto w-full max-w-[78rem] rounded-2xl border border-border bg-card p-6 md:p-8">
      <div
        className="relative h-[10.5rem] overflow-hidden font-mono text-xl leading-loose select-none md:text-2xl"
        role="textbox"
        aria-label="Typing test area"
        aria-readonly="true"
      >
        <div
          className="transition-transform duration-300 ease-out"
          style={{ transform: `translateY(-${translateY}px)` }}
        >
          {lineLayout.lines.map((lineWordIndices, lineIndex) => (
            <div
              key={`line-${lineIndex}`}
              className="flex min-h-14 flex-wrap items-center gap-3 pr-4"
            >
              {lineWordIndices.map((wordIndex) => {
                const isActive = wordIndex === currentWordIndex
                const charStates = getWordCharStates(wordIndex)
                const isGhostWord = ghostCursor?.wordIndex === wordIndex && testState === "running"

                return (
                  <div
                    key={wordIndex}
                    className={`relative rounded px-1 py-0.5 transition-all ${
                      isActive
                        ? "bg-foreground/6"
                        : "opacity-78"
                    } ${lineIndex === activeLine ? "opacity-100" : ""}`}
                  >
                    {charStates.map((cs, charIdx) => {
                      const isCaretHere =
                        isActive && charIdx === currentCharIndex && testState !== "finished"
                      const isGhostCaret = isGhostWord && ghostCursor?.charIndex === charIdx

                      return (
                        <span key={charIdx} className="relative">
                          {isCaretHere && (
                            <span
                              className="absolute -left-px top-[3px] h-[1.25em] w-[2.5px] rounded-full bg-typing-caret animate-pulse"
                              aria-hidden="true"
                            />
                          )}
                          {isGhostCaret && (
                            <span
                              className="absolute -left-px top-[3px] h-[1.25em] w-[2px] rounded-full bg-slate-400/70"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={
                              cs.status === "correct"
                                ? "text-typing-correct"
                                : cs.status === "incorrect"
                                  ? "text-typing-incorrect underline decoration-typing-incorrect/40"
                                  : cs.status === "extra"
                                    ? "text-typing-extra"
                                    : "text-typing-untyped"
                            }
                          >
                            {cs.char}
                          </span>
                        </span>
                      )
                    })}
                    {isActive &&
                      currentCharIndex >= charStates.length &&
                      testState !== "finished" && (
                        <span
                          className="absolute -right-px top-[3px] h-[1.25em] w-[2.5px] rounded-full bg-typing-caret animate-pulse"
                          aria-hidden="true"
                        />
                      )}
                    {isGhostWord &&
                      (ghostCursor?.charIndex ?? 0) >= charStates.length &&
                      testState === "running" && (
                        <span
                          className="absolute -right-px top-[3px] h-[1.25em] w-[2px] rounded-full bg-slate-400/70"
                          aria-hidden="true"
                        />
                      )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
