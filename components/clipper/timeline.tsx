"use client"

import { useCallback, useMemo, useRef } from "react"

import { cn } from "@/lib/utils"

type TimelineProps = {
  duration: number
  current: number
  start: number
  end: number
  onSeek: (t: number) => void
  onRangeChange: (range: { start: number; end: number }) => void
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`
}

type DragMode = "playhead" | "start" | "end" | null

export function Timeline({ duration, current, start, end, onSeek, onRangeChange }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragMode>(null)

  const pct = useCallback(
    (t: number) => (duration > 0 ? (t / duration) * 100 : 0),
    [duration],
  )

  const positionFromEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || duration <= 0) return 0
      const rect = track.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return ratio * duration
    },
    [duration],
  )

  const handlePointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = mode
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const t = positionFromEvent(e.clientX)
    if (dragRef.current === "playhead") {
      onSeek(Math.max(0, Math.min(duration, t)))
    } else if (dragRef.current === "start") {
      onRangeChange({ start: Math.max(0, Math.min(t, end - 0.5)), end })
    } else if (dragRef.current === "end") {
      onRangeChange({ start, end: Math.max(start + 0.5, Math.min(t, duration)) })
    }
  }

  const handlePointerUp = () => {
    dragRef.current = null
  }

  const handleTrackClick = (e: React.PointerEvent) => {
    const t = positionFromEvent(e.clientX)
    onSeek(t)
  }

  const ticks = useMemo(() => {
    if (duration <= 0) return [] as number[]
    const count = 10
    return Array.from({ length: count + 1 }, (_, i) => (duration * i) / count)
  }, [duration])

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{formatTime(current)}</span>
        <span className="text-foreground">
          {formatTime(start)} <span className="text-muted-foreground">→</span> {formatTime(end)}
        </span>
        <span>{formatTime(duration)}</span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={handleTrackClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-12 cursor-pointer rounded-md border border-border bg-secondary/40"
      >
        {/* tick marks */}
        <div className="pointer-events-none absolute inset-0 flex justify-between px-0">
          {ticks.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-full w-px",
                i === 0 || i === ticks.length - 1 ? "bg-transparent" : "bg-border/60",
              )}
            />
          ))}
        </div>

        {/* selection range */}
        <div
          className="pointer-events-none absolute inset-y-0 bg-primary/15 ring-1 ring-inset ring-primary/40"
          style={{ left: `${pct(start)}%`, width: `${Math.max(0, pct(end) - pct(start))}%` }}
        />

        {/* start handle */}
        <div
          onPointerDown={handlePointerDown("start")}
          className="absolute inset-y-0 z-10 -ml-1.5 w-3 cursor-ew-resize"
          style={{ left: `${pct(start)}%` }}
        >
          <div className="mx-auto h-full w-1 rounded-full bg-primary" />
        </div>

        {/* end handle */}
        <div
          onPointerDown={handlePointerDown("end")}
          className="absolute inset-y-0 z-10 -ml-1.5 w-3 cursor-ew-resize"
          style={{ left: `${pct(end)}%` }}
        >
          <div className="mx-auto h-full w-1 rounded-full bg-primary" />
        </div>

        {/* playhead */}
        <div
          onPointerDown={handlePointerDown("playhead")}
          className="absolute inset-y-0 z-20 -ml-1 w-2 cursor-grab active:cursor-grabbing"
          style={{ left: `${pct(current)}%` }}
        >
          <div className="mx-auto h-full w-0.5 bg-foreground" />
          <div className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full bg-foreground shadow" />
        </div>
      </div>
    </div>
  )
}
