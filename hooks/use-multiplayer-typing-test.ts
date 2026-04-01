"use client"

import { useState, useCallback, useRef, useEffect } from "react"

export interface CharState {
  char: string
  status: "correct" | "incorrect" | "untyped" | "extra"
}

export type MultiplayerTestState = "waiting" | "countdown" | "playing" | "finished"

interface UseMultiplayerTypingTestOptions {
  words: string[]
  timeLimit: number
  onProgress: (data: { wordIndex: number; wpm: number; accuracy: number; progress: number }) => void
  onFinish: (data: {
    wpm: number
    rawWpm: number
    accuracy: number
    correctChars: number
    incorrectChars: number
    extraChars: number
  }) => void
}

export function useMultiplayerTypingTest({
  words,
  timeLimit,
  onProgress,
  onFinish,
}: UseMultiplayerTypingTestOptions) {
  const [testState, setTestState] = useState<MultiplayerTestState>("waiting")
  const [timeLeft, setTimeLeft] = useState<number>(timeLimit)
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [wordInputs, setWordInputs] = useState<string[]>([])
  const [liveWpm, setLiveWpm] = useState(0)
  const [liveAccuracy, setLiveAccuracy] = useState(100)

  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasFinishedRef = useRef(false)
  const onProgressRef = useRef(onProgress)
  const onFinishRef = useRef(onFinish)

  // Keep refs up to date without triggering re-renders
  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  const calculateStats = useCallback(
    (finalWordInputs: string[], finalWords: string[], elapsed: number) => {
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

      const completedWords = finalWordInputs.length - 1
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

  const endTest = useCallback(() => {
    if (hasFinishedRef.current) return
    hasFinishedRef.current = true

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTestState("finished")

    const elapsed = (Date.now() - startTimeRef.current) / 1000

    setWordInputs((prev) => {
      const computed = calculateStats(prev, words, elapsed)
      onFinishRef.current({
        wpm: computed.wpm,
        rawWpm: computed.rawWpm,
        accuracy: computed.accuracy,
        correctChars: computed.correctChars,
        incorrectChars: computed.incorrectChars,
        extraChars: computed.extraChars,
      })
      return prev
    })
  }, [words, calculateStats])

  // Start the test -- called when server sends game:start
  const startTest = useCallback(() => {
    startTimeRef.current = Date.now()
    hasFinishedRef.current = false
    setTestState("playing")
    setTimeLeft(timeLimit)
    setCurrentWordIndex(0)
    setCurrentCharIndex(0)
    setWordInputs([])
    setLiveWpm(0)

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const remaining = Math.max(0, timeLimit - elapsed)
      setTimeLeft(Math.ceil(remaining))

      if (elapsed > 0) {
        setWordInputs((prev) => {
          const computed = calculateStats(prev, words, elapsed)
          setLiveWpm(computed.wpm)
          setLiveAccuracy(computed.accuracy)

          // Calculate progress based on word completion
          setCurrentWordIndex((curWordIdx) => {
            const totalWords = words.length
            const progress = totalWords > 0 ? Math.round((curWordIdx / totalWords) * 100) : 0
            onProgressRef.current({
              wordIndex: curWordIdx,
              wpm: computed.wpm,
              accuracy: computed.accuracy,
              progress,
            })
            return curWordIdx
          })

          return prev
        })
      }

      if (remaining <= 0) {
        endTest()
      }
    }, 200)
  }, [timeLimit, words, calculateStats, endTest])

  // Reset everything for a new game
  const resetTest = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    hasFinishedRef.current = false
    setTestState("waiting")
    setTimeLeft(timeLimit)
    setCurrentWordIndex(0)
    setCurrentCharIndex(0)
    setWordInputs([])
    setLiveWpm(0)
    setLiveAccuracy(100)
  }, [timeLimit])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return

      // In multiplayer, Tab and Esc are blocked during gameplay
      if (e.key === "Tab" || e.key === "Escape") {
        e.preventDefault()
        return
      }

      if (testState !== "playing") return

      const currentWord = words[currentWordIndex] || ""

      if (e.key === "Backspace") {
        e.preventDefault()
        if (currentCharIndex > 0) {
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
          setCurrentWordIndex(previousWordIndex)
          setCurrentCharIndex(previousLength)
        }
        return
      }

      if (e.key === " ") {
        e.preventDefault()
        if (currentCharIndex === 0) return
        setCurrentWordIndex((prev) => prev + 1)
        setCurrentCharIndex(0)
        return
      }

      if (e.key.length === 1) {
        e.preventDefault()
        if (currentCharIndex >= currentWord.length + 10) return
        setCurrentCharIndex((prev) => prev + 1)
        setWordInputs((prev) => {
          const newInputs = [...prev]
          const current = newInputs[currentWordIndex] || ""
          newInputs[currentWordIndex] = current + e.key
          return newInputs
        })
      }
    },
    [testState, words, currentWordIndex, currentCharIndex]
  )

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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return {
    testState,
    timeLeft,
    currentWordIndex,
    currentCharIndex,
    liveWpm,
    liveAccuracy,
    words,
    handleKeyDown,
    getWordCharStates,
    startTest,
    resetTest,
    endTest,
  }
}
