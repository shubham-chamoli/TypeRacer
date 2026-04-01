"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { generateWords, type Difficulty } from "@/lib/words"

export type TimerOption = 15 | 30 | 60

export interface CharState {
  char: string
  status: "correct" | "incorrect" | "untyped" | "extra"
}

export interface WpmDataPoint {
  time: number
  wpm: number
  raw: number
}

export interface CursorSnapshot {
  time: number
  wordIndex: number
  charIndex: number
}

export interface GhostCursor {
  wordIndex: number
  charIndex: number
  deltaWords: number
}

export interface TestStats {
  wpm: number
  rawWpm: number
  accuracy: number
  correctChars: number
  incorrectChars: number
  extraChars: number
  totalChars: number
  time: number
  wpmHistory: WpmDataPoint[]
  consistencyScore: number
  errorKeyMap: Record<string, number>
  wordHeat: number[]
  cursorTimeline: CursorSnapshot[]
  wordsSnapshot: string[]
}

export type TestState = "idle" | "running" | "finished"

const WORD_COUNT = 200
const PB_KEY = "typeracer:solo-best-wpm"
const PB_RUN_KEY = "typeracer:solo-best-run"

interface BestRunPayload {
  wpm: number
  cursorTimeline: CursorSnapshot[]
}

export function useTypingTest() {
  const [timerOption, setTimerOption] = useState<TimerOption>(30)
  const [difficulty, setDifficulty] = useState<Difficulty>("normal")
  const [testState, setTestState] = useState<TestState>("idle")
  const [timeLeft, setTimeLeft] = useState<number>(30)
  const [words, setWords] = useState<string[]>(() => generateWords(WORD_COUNT, "normal"))
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [wordInputs, setWordInputs] = useState<string[]>([])
  const [liveWpm, setLiveWpm] = useState(0)
  const [liveAccuracy, setLiveAccuracy] = useState(100)
  const [liveRhythm, setLiveRhythm] = useState(0)
  const [wordHeat, setWordHeat] = useState<number[]>([])
  const [ghostCursor, setGhostCursor] = useState<GhostCursor | null>(null)
  const [stats, setStats] = useState<TestStats | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(false)

  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const wpmHistoryRef = useRef<WpmDataPoint[]>([])
  const lastKeystrokeRef = useRef<number | null>(null)
  const rhythmIntervalsRef = useRef<number[]>([])
  const wordLatencyRef = useRef<Record<number, { total: number; count: number }>>({})
  const cursorTimelineRef = useRef<CursorSnapshot[]>([])
  const errorKeyMapRef = useRef<Record<string, number>>({})
  const bestRunRef = useRef<BestRunPayload | null>(null)
  const isRunningRef = useRef(false)
  const currentWordRef = useRef(0)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PB_RUN_KEY)
      bestRunRef.current = stored ? (JSON.parse(stored) as BestRunPayload) : null
    } catch {
      bestRunRef.current = null
    }
  }, [])

  const playKeySound = useCallback(() => {
    if (!soundEnabled) return
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.frequency.setValueAtTime(600 + Math.random() * 100, ctx.currentTime)
      oscillator.type = "sine"
      gainNode.gain.setValueAtTime(0.02, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.04)
    } catch {
      // Audio not available
    }
  }, [soundEnabled])

  const calculateStats = useCallback(
    (finalWordInputs: string[], finalWords: string[], elapsed: number, completedWords: number) => {
      let correctChars = 0
      let incorrectChars = 0
      let extraChars = 0
      let totalChars = 0

      for (let w = 0; w < finalWordInputs.length; w++) {
        const typed = finalWordInputs[w] || ""
        const target = finalWords[w] || ""
        totalChars += typed.length

        for (let c = 0; c < typed.length; c++) {
          if (c < target.length) {
            if (typed[c] === target[c]) {
              correctChars++
            } else {
              incorrectChars++
            }
          } else {
            extraChars++
          }
        }
      }

      if (completedWords > 0) {
        correctChars += completedWords
        totalChars += completedWords
      }

      const minutes = elapsed / 60
      const wpm = minutes > 0 ? Math.round(correctChars / 5 / minutes) : 0
      const rawWpm = minutes > 0 ? Math.round(totalChars / 5 / minutes) : 0
      const accuracy =
        totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100

      return { wpm, rawWpm, accuracy, correctChars, incorrectChars, extraChars, totalChars }
    },
    []
  )

  const deriveHeat = useCallback(() => {
    const entries = Object.entries(wordLatencyRef.current)
    if (entries.length === 0) return

    const averages = entries.map(([idx, bucket]) => ({
      idx: Number(idx),
      avg: bucket.total / Math.max(1, bucket.count),
    }))

    const min = Math.min(...averages.map((x) => x.avg))
    const max = Math.max(...averages.map((x) => x.avg))
    const next: number[] = []

    for (const point of averages) {
      const normalized = max > min ? (point.avg - min) / (max - min) : 0
      next[point.idx] = Number(normalized.toFixed(3))
    }

    setWordHeat(next)
  }, [])

  const updateRhythm = useCallback((interval: number) => {
    const list = [...rhythmIntervalsRef.current, interval].slice(-12)
    rhythmIntervalsRef.current = list

    if (list.length < 4) {
      setLiveRhythm(0)
      return
    }

    const mean = list.reduce((a, b) => a + b, 0) / list.length
    const variance = list.reduce((acc, value) => acc + (value - mean) ** 2, 0) / list.length
    const stdDev = Math.sqrt(variance)

    const score = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, stdDev - 16) * 1.8)))
    setLiveRhythm(score)
  }, [])

  const trackKeyTiming = useCallback((wordIdx: number, nextWordIdx: number, nextCharIdx: number) => {
    const now = Date.now()
    if (testState !== "running") {
      lastKeystrokeRef.current = now
      return
    }

    if (lastKeystrokeRef.current) {
      const interval = now - lastKeystrokeRef.current
      if (interval > 0 && interval < 3000) {
        updateRhythm(interval)

        const bucket = wordLatencyRef.current[wordIdx] || { total: 0, count: 0 }
        bucket.total += interval
        bucket.count += 1
        wordLatencyRef.current[wordIdx] = bucket
        deriveHeat()
      }
    }

    lastKeystrokeRef.current = now
    const elapsed = Math.max(0, (now - startTimeRef.current) / 1000)
    cursorTimelineRef.current.push({
      time: elapsed,
      wordIndex: nextWordIdx,
      charIndex: nextCharIdx,
    })
  }, [deriveHeat, testState, updateRhythm])

  const updateGhostCursor = useCallback((elapsed: number) => {
    const run = bestRunRef.current
    if (!run || run.cursorTimeline.length === 0) {
      setGhostCursor(null)
      return
    }

    let target = run.cursorTimeline[run.cursorTimeline.length - 1]
    for (const point of run.cursorTimeline) {
      if (point.time >= elapsed) {
        target = point
        break
      }
    }

    setGhostCursor({
      wordIndex: target.wordIndex,
      charIndex: target.charIndex,
      deltaWords: target.wordIndex - currentWordRef.current,
    })
  }, [])

  const endTest = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    isRunningRef.current = false
    setTestState("finished")

    const elapsed = Math.min(timerOption, (Date.now() - startTimeRef.current) / 1000)
    setWordInputs((prev) => {
      setWords((currentWords) => {
        const computed = calculateStats(prev, currentWords, elapsed, currentWordRef.current)
        const wpmValues = wpmHistoryRef.current.map((p) => p.wpm)
        const avg = wpmValues.length > 0 ? wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length : computed.wpm
        const variance = wpmValues.length > 0
          ? wpmValues.reduce((acc, val) => acc + (val - avg) ** 2, 0) / wpmValues.length
          : 0
        const stdDev = Math.sqrt(variance)
        const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - stdDev * 1.7)))

        const newStats: TestStats = {
          ...computed,
          time: elapsed,
          wpmHistory: [...wpmHistoryRef.current],
          consistencyScore,
          errorKeyMap: { ...errorKeyMapRef.current },
          wordHeat: [...wordHeat],
          cursorTimeline: [...cursorTimelineRef.current],
          wordsSnapshot: [...currentWords],
        }

        setStats(newStats)

        try {
          const existingBest = Number(window.localStorage.getItem(PB_KEY) || 0)
          if (computed.wpm > existingBest) {
            window.localStorage.setItem(PB_KEY, String(computed.wpm))
            const payload: BestRunPayload = {
              wpm: computed.wpm,
              cursorTimeline: [...cursorTimelineRef.current],
            }
            window.localStorage.setItem(PB_RUN_KEY, JSON.stringify(payload))
            bestRunRef.current = payload
          }
        } catch {
          // ignore storage issues
        }

        return currentWords
      })
      return prev
    })
  }, [calculateStats, timerOption, wordHeat])

  const startTest = useCallback(() => {
    startTimeRef.current = Date.now()
    setTestState("running")
    isRunningRef.current = true
    setTimeLeft(timerOption)
    wpmHistoryRef.current = []
    rhythmIntervalsRef.current = []
    wordLatencyRef.current = {}
    errorKeyMapRef.current = {}
    cursorTimelineRef.current = [{ time: 0, wordIndex: 0, charIndex: 0 }]
    setWordHeat([])
    setLiveRhythm(0)

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const remaining = Math.max(0, timerOption - elapsed)
      setTimeLeft(Math.ceil(remaining))

      if (elapsed > 0) {
        setWordInputs((prev) => {
          setWords((currentWords) => {
            const computed = calculateStats(prev, currentWords, elapsed, currentWordRef.current)
            setLiveWpm(computed.wpm)
            setLiveAccuracy(computed.accuracy)

            const currentSecond = Math.floor(elapsed)
            const lastRecorded = wpmHistoryRef.current.length > 0
              ? wpmHistoryRef.current[wpmHistoryRef.current.length - 1].time
              : -1
            if (currentSecond > lastRecorded && currentSecond > 0) {
              wpmHistoryRef.current.push({
                time: currentSecond,
                wpm: computed.wpm,
                raw: computed.rawWpm,
              })
            }

            return currentWords
          })
          return prev
        })

        updateGhostCursor(elapsed)
      }

      if (remaining <= 0) {
        endTest()
      }
    }, 200)
  }, [timerOption, calculateStats, endTest, updateGhostCursor])

  const resetTest = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    isRunningRef.current = false
    setTestState("idle")
    setTimeLeft(timerOption)
    setCurrentWordIndex(0)
    setCurrentCharIndex(0)
    setWordInputs([])
    setLiveWpm(0)
    setLiveAccuracy(100)
    setLiveRhythm(0)
    setWordHeat([])
    setGhostCursor(null)
    setStats(null)
    wpmHistoryRef.current = []
    rhythmIntervalsRef.current = []
    wordLatencyRef.current = {}
    cursorTimelineRef.current = []
    errorKeyMapRef.current = {}
    setWords(generateWords(WORD_COUNT, difficulty))
  }, [timerOption, difficulty])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return

      if (e.key === "Tab" || e.key === "Escape") {
        e.preventDefault()
        resetTest()
        return
      }

      if (testState === "finished") return

      if (testState === "idle" && e.key.length === 1) {
        startTest()
      }

      if (testState === "idle" || testState === "running") {
        const currentWord = words[currentWordIndex] || ""

        if (e.key === "Backspace") {
          e.preventDefault()
          if (currentCharIndex > 0) {
            if (testState === "running") {
              trackKeyTiming(currentWordIndex, currentWordIndex, currentCharIndex - 1)
            }
            playKeySound()
            setCurrentCharIndex((prev) => prev - 1)
            setWordInputs((prev) => {
              const newInputs = [...prev]
              const current = newInputs[currentWordIndex] || ""
              newInputs[currentWordIndex] = current.slice(0, -1)
              return newInputs
            })
          } else if (currentWordIndex > 0) {
            const previousWordIndex = currentWordIndex - 1
            const previousLength = (wordInputs[previousWordIndex] || "").length
            if (testState === "running") {
              trackKeyTiming(currentWordIndex, previousWordIndex, previousLength)
            }
            playKeySound()
            setCurrentWordIndex(previousWordIndex)
            setCurrentCharIndex(previousLength)
          }
          return
        }

        if (e.key === " ") {
          e.preventDefault()
          if (currentCharIndex === 0) return
          if (testState === "running") {
            trackKeyTiming(currentWordIndex, currentWordIndex + 1, 0)
          }
          playKeySound()
          setCurrentWordIndex((prev) => prev + 1)
          setCurrentCharIndex(0)
          return
        }

        if (e.key.length === 1) {
          e.preventDefault()
          if (currentCharIndex >= currentWord.length + 10) return
          if (testState === "running") {
            trackKeyTiming(currentWordIndex, currentWordIndex, currentCharIndex + 1)
          }

          const expected = currentWord[currentCharIndex] || ""
          if (!expected || e.key !== expected) {
            const key = e.key.toLowerCase()
            if (key.length === 1) {
              errorKeyMapRef.current[key] = (errorKeyMapRef.current[key] || 0) + 1
            }
          }

          playKeySound()
          setCurrentCharIndex((prev) => prev + 1)
          setWordInputs((prev) => {
            const newInputs = [...prev]
            const current = newInputs[currentWordIndex] || ""
            newInputs[currentWordIndex] = current + e.key
            return newInputs
          })
        }
      }
    },
    [
      testState,
      words,
      currentWordIndex,
      currentCharIndex,
      startTest,
      resetTest,
      playKeySound,
      trackKeyTiming,
    ]
  )

  useEffect(() => {
    if (testState === "finished") return
    if (words.length - currentWordIndex > 80) return

    setWords((prev) => [...prev, ...generateWords(120, difficulty)])
  }, [currentWordIndex, difficulty, testState, words.length])

  useEffect(() => {
    isRunningRef.current = testState === "running"
  }, [testState])

  useEffect(() => {
    currentWordRef.current = currentWordIndex
  }, [currentWordIndex])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const getWordCharStates = useCallback(
    (wordIndex: number): CharState[] => {
      const word = words[wordIndex] || ""
      const typed = wordInputs[wordIndex] || ""
      const chars: CharState[] = []

      for (let i = 0; i < Math.max(word.length, typed.length); i++) {
        if (i < typed.length) {
          if (i < word.length) {
            chars.push({
              char: word[i],
              status: typed[i] === word[i] ? "correct" : "incorrect",
            })
          } else {
            chars.push({ char: typed[i], status: "extra" })
          }
        } else {
          chars.push({ char: word[i], status: "untyped" })
        }
      }

      return chars
    },
    [words, wordInputs]
  )

  const changeTimer = useCallback(
    (newTimer: TimerOption) => {
      setTimerOption(newTimer)
      if (testState !== "running") {
        setTimeLeft(newTimer)
      }
    },
    [testState]
  )

  const changeDifficulty = useCallback(
    (newDifficulty: Difficulty) => {
      setDifficulty(newDifficulty)
      if (testState !== "running") {
        setWords(generateWords(WORD_COUNT, newDifficulty))
        setCurrentWordIndex(0)
        setCurrentCharIndex(0)
        setWordInputs([])
      }
    },
    [testState]
  )

  return {
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
    wordHeat,
    ghostCursor,
    stats,
    soundEnabled,
    setSoundEnabled,
    handleKeyDown,
    resetTest,
    getWordCharStates,
    changeTimer,
    changeDifficulty,
  }
}
