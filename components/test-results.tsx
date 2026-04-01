"use client"

import { useEffect, useMemo, useState } from "react"
import type { TestStats } from "@/hooks/use-typing-test"
import {
  RotateCcw,
  Target,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Sparkles,
} from "lucide-react"
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts"

interface TestResultsProps {
  stats: TestStats
  onRestart: () => void
}

const PB_KEY = "typeracer:solo-best-wpm"

function StatCard({
  icon,
  label,
  value,
  unit,
  accent = false,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  unit?: string
  accent?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-4 ${
      accent ? "border-primary/20 bg-primary/5" : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: number }) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}s</p>
      <p className="text-sm font-medium text-primary">WPM: {payload[0].value}</p>
    </div>
  )
}

export function TestResults({ stats, onRestart }: TestResultsProps) {
  const [previousBest, setPreviousBest] = useState(0)
  const [bestWpm, setBestWpm] = useState<number>(0)

  useEffect(() => {
    const stored = window.localStorage.getItem(PB_KEY)
    const previousBest = stored ? Number(stored) : 0
    setPreviousBest(previousBest)
    setBestWpm(previousBest)

    const nextBest = Math.max(previousBest, stats.wpm)
    if (nextBest !== previousBest) {
      window.localStorage.setItem(PB_KEY, String(nextBest))
      setBestWpm(nextBest)
    }
  }, [stats.wpm])

  const isNewRecord = useMemo(() => stats.wpm > previousBest, [previousBest, stats.wpm])
  const errors = stats.incorrectChars + stats.extraChars
  const chartData = stats.wpmHistory.length > 0 ? stats.wpmHistory : [{ time: Math.round(stats.time), wpm: stats.wpm, raw: stats.rawWpm }]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto w-full max-w-4xl duration-300">
      <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-primary" />
          <span className="text-sm text-muted-foreground">Personal Best</span>
          <span className="text-lg font-bold text-primary tabular-nums">{bestWpm}</span>
          <span className="text-xs text-muted-foreground">wpm</span>
        </div>
        {isNewRecord && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-300">
            <Sparkles size={13} />
            New Record
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard icon={<Zap size={14} />} label="WPM" value={stats.wpm} accent />
        <StatCard icon={<Target size={14} />} label="Accuracy" value={stats.accuracy} unit="%" accent />
        <StatCard icon={<AlertTriangle size={14} />} label="Errors" value={errors} />
        <StatCard icon={<Clock size={14} />} label="Time" value={Math.round(stats.time)} unit="sec" />
        <StatCard icon={<TrendingUp size={14} />} label="Raw" value={stats.rawWpm} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4 md:p-6">
        <h3 className="mb-4 text-sm font-medium text-foreground">Progression (WPM over time)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}s`}
            />
            <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="wpm"
              stroke="#22d3ee"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "#22d3ee" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4 md:p-6">
        <h3 className="mb-3 text-sm font-medium text-foreground">Character Breakdown</h3>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span className="text-sm text-muted-foreground">Correct</span>
            <span className="text-sm font-semibold text-foreground">{stats.correctChars}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-destructive" />
            <span className="text-sm text-muted-foreground">Wrong</span>
            <span className="text-sm font-semibold text-foreground">{stats.incorrectChars}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-sm text-muted-foreground">Extra</span>
            <span className="text-sm font-semibold text-foreground">{stats.extraChars}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <button
          onClick={onRestart}
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          aria-label="Restart test"
        >
          <RotateCcw size={16} />
          <span>Try Again</span>
        </button>
        <p className="text-xs text-muted-foreground">Tab or Esc to restart</p>
      </div>
    </div>
  )
}