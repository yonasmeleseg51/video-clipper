"use client"

import { Scissors, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type Clip = {
  title: string
  start: number
  end: number
  reason: string
  virality: number
  thumbnail?: string
}

type ClipCardProps = {
  index: number
  clip: Clip
  active: boolean
  onSelect: () => void
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function ClipCard({ index, clip, active, onSelect }: ClipCardProps) {
  const duration = Math.max(0, clip.end - clip.start)
  return (
    <Card
      className={cn(
        "flex flex-col gap-3 border-border bg-card/60 p-0 transition",
        active && "border-primary/40 ring-1 ring-primary/30",
      )}
    >
      {clip.thumbnail && (
        <button
          type="button"
          onClick={onSelect}
          className="group relative aspect-video w-full overflow-hidden rounded-t-xl bg-black"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={clip.thumbnail || "/placeholder.svg"}
            alt={`Preview frame for ${clip.title}`}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <Badge variant="secondary" className="gap-1 bg-black/60 text-white backdrop-blur">
              <Sparkles className="size-3 text-primary" />
              {Math.round(clip.virality)}
            </Badge>
            <span className="font-mono text-xs text-white/90">{duration.toFixed(1)}s</span>
          </div>
        </button>
      )}
      <div className="flex flex-col gap-3 p-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
            {!clip.thumbnail && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3 text-primary" />
                {Math.round(clip.virality)}
              </Badge>
            )}
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {formatTime(clip.start)} - {formatTime(clip.end)}
          </span>
        </div>
        <h4 className="text-pretty text-sm font-medium leading-snug">{clip.title}</h4>
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{clip.reason}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-mono text-xs text-muted-foreground">
            {clip.thumbnail ? `${formatTime(clip.start)}` : `${duration.toFixed(1)}s`}
          </span>
          <Button size="sm" variant={active ? "default" : "secondary"} onClick={onSelect}>
            <Scissors className="size-3.5" />
            {active ? "Selected" : "Use clip"}
          </Button>
        </div>
      </div>
    </Card>
  )
}
