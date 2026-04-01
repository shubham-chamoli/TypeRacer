"use client"

import { useEffect, useRef } from "react"
import { useTypingTest } from "../hooks/use-typing-test"
import { TestConfig } from "@/components/test-config"
import { TypingDisplay } from "@/components/typing-display"
import { TimerDisplay } from "@/components/timer-display"
import { TestResults } from "../components/test-results"

export default function TypingTestPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    timerOption,
    difficulty,
    testState,
    timeLeft,
    words,
    currentWordIndex,
    currentCharIndex,
    liveWpm,
    liveAccuracy,
    liveRhythm,
    ghostCursor,
    stats,
    soundEnabled,
    setSoundEnabled,
    handleKeyDown,
    resetTest,
    getWordCharStates,
    changeTimer,
    changeDifficulty,
  } = useTypingTest()

  useEffect(() => {
    inputRef.current?.focus()

    function handleWindowFocus() {
      inputRef.current?.focus()
    }

    window.addEventListener("focus", handleWindowFocus)

    return () => {
      window.removeEventListener("focus", handleWindowFocus)
    }
  }, [])

  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background text-foreground"
      onMouseDown={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        autoFocus
        onBlur={() => {
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
        className="pointer-events-none absolute left-[-9999px] top-0 h-0 w-0 opacity-0 caret-transparent"
        aria-hidden="true"
      />

      {/* Main */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 py-8">
        {testState !== "finished" && (
          <>
            {/* Config */}
            <div
              className={`transition-all duration-300 ${
                testState === "running"
                  ? "pointer-events-none -translate-y-2 opacity-0"
                  : "opacity-100"
              }`}
            >
              <TestConfig
                timerOption={timerOption}
                difficulty={difficulty}
                soundEnabled={soundEnabled}
                onTimerChange={changeTimer}
                onDifficultyChange={changeDifficulty}
                onSoundToggle={setSoundEnabled}
                disabled={testState === "running"}
              />
            </div>

            {/* Timer + Live stats */}
            <div className="min-h-[4rem]">
              <TimerDisplay
                timeLeft={timeLeft}
                liveWpm={liveWpm}
                liveAccuracy={liveAccuracy}
                liveRhythm={liveRhythm}
                testState={testState}
              />
            </div>

            {/* Typing area */}
            <TypingDisplay
              words={words}
              currentWordIndex={currentWordIndex}
              currentCharIndex={currentCharIndex}
              getWordCharStates={getWordCharStates}
              testState={testState}
            />

            {/* Help text */}
            <div className="flex justify-center">
              <span className="text-xs text-muted-foreground">
                {'Tab / Esc to restart'}
              </span>
            </div>
          </>
        )}

        {/* Results */}
        {testState === "finished" && stats && (
          <TestResults stats={stats} onRestart={resetTest} />
        )}
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-5xl px-6 pb-6">
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
          <span>TypeRacer</span>
          <span>Built with Next.js and Socket.io</span>
        </div>
      </footer>
    </div>
  )
}
