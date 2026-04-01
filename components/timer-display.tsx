"use client"

import type { TestState } from "@/hooks/use-typing-test"
import { Clock, Activity } from "lucide-react"

interface TimerDisplayProps {
  timeLeft: number
  liveWpm: number
  liveAccuracy: number
  liveRhythm: number
  testState: TestState
}

export function TimerDisplay({ timeLeft, liveWpm, liveAccuracy, liveRhythm, testState }: TimerDisplayProps) {
  if (testState !== "running") {
    return (
      <div className="flex h-16 items-center justify-center">
        <p className="text-center text-sm text-muted-foreground">Start typing to begin the race</p>
      </div>
    )
  }

  const isLow = timeLeft <= 5

  return (
    <div className="animate-in fade-in flex h-16 items-center justify-center gap-4 duration-300">
      <div className={`flex items-center gap-2 rounded-xl border px-5 py-3 ${
        isLow ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"
      }`}>
        <Clock size={18} className={isLow ? "text-destructive" : "text-muted-foreground"} />
        <span className={`text-3xl font-bold tabular-nums ${isLow ? "text-destructive" : "text-foreground"}`}>
          {timeLeft}
        </span>
        <span className={`text-xs ${isLow ? "text-destructive/70" : "text-muted-foreground"}`}>sec</span>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-5 py-3">
        <Activity size={18} className="text-primary" />
        <span className="text-3xl font-bold tabular-nums text-primary">{liveWpm}</span>
        <span className="text-xs text-primary/70">wpm</span>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3">
        <span className="text-sm font-medium text-emerald-300">acc</span>
        <span className="text-3xl font-bold tabular-nums text-emerald-300">{liveAccuracy}</span>
        <span className="text-xs text-emerald-300/70">%</span>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-amber-300">rhythm</span>
        <div className="h-2.5 w-20 overflow-hidden rounded-full bg-amber-200/10">
          <div
            className="h-full rounded-full bg-amber-300 transition-all duration-200"
            style={{
              width: `${liveRhythm}%`,
              boxShadow: liveRhythm > 70 ? "0 0 12px rgba(252,211,77,0.7)" : "none",
            }}
          />
        </div>
        <span className="w-8 text-right text-xs font-semibold text-amber-200 tabular-nums">
          {liveRhythm}
        </span>
      </div>
    </div>
  )
}
