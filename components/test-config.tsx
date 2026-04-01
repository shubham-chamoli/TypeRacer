"use client"

import { type TimerOption } from "@/hooks/use-typing-test"
import { type Difficulty } from "@/lib/words"
import { Volume2, VolumeX, Timer, Gauge, Zap } from "lucide-react"

interface TestConfigProps {
  timerOption: TimerOption
  difficulty: Difficulty
  soundEnabled: boolean
  onTimerChange: (timer: TimerOption) => void
  onDifficultyChange: (difficulty: Difficulty) => void
  onSoundToggle: (enabled: boolean) => void
  disabled: boolean
}

export function TestConfig({
  timerOption,
  difficulty,
  soundEnabled,
  onTimerChange,
  onDifficultyChange,
  onSoundToggle,
  disabled,
}: TestConfigProps) {
  const timers: TimerOption[] = [15, 30, 60]
  const difficulties: { value: Difficulty; label: string; icon: React.ReactNode }[] = [
    { value: "easy", label: "Easy", icon: <Zap size={14} /> },
    { value: "normal", label: "Medium", icon: <Gauge size={14} /> },
    { value: "hard", label: "Hard", icon: <Timer size={14} /> },
  ]

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-3 rounded-2xl border border-border/70 bg-card/40 p-3 backdrop-blur-sm md:grid-cols-[1fr_1fr_auto] md:items-end">
      {/* Difficulty */}
      <div className="flex flex-col gap-2">
        <div className="flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Gauge size={12} />
          Difficulty
        </div>
        <div className="flex items-center rounded-xl border border-border bg-background/80 p-1">
          {difficulties.map((d) => (
            <button
              key={d.value}
              onClick={() => !disabled && onDifficultyChange(d.value)}
              disabled={disabled}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                difficulty === d.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              aria-label={`Set difficulty to ${d.label}`}
            >
              {d.icon}
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timer */}
      <div className="flex flex-col gap-2">
        <div className="flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <Timer size={12} />
          Time
        </div>
        <div className="flex items-center rounded-xl border border-border bg-background/80 p-1">
          {timers.map((t) => (
            <button
              key={t}
              onClick={() => !disabled && onTimerChange(t)}
              disabled={disabled}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                timerOption === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              aria-label={`Set timer to ${t} seconds`}
            >
              {t}s
            </button>
          ))}
        </div>
      </div>

      {/* Sound toggle */}
      <button
        onClick={() => onSoundToggle(!soundEnabled)}
        className={`flex h-[42px] w-[42px] items-center justify-center rounded-xl border text-sm font-medium transition-all cursor-pointer ${
          soundEnabled
            ? "border-primary/40 bg-primary/12 text-primary"
            : "border-border bg-background/80 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        }`}
        aria-label={soundEnabled ? "Disable sound" : "Enable sound"}
      >
        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>
    </div>
  )
}
