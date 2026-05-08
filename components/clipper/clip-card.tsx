"use client"

import { Check, Copy, Scissors, Sparkles } from "lucide-react"
import { useState } from "react"

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
  const [copied, setCopied] = useState(false)
  const duration = Math.max(0, clip.end - clip.start)

  const copyToClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = `${clip.title}\n\n${clip.reason}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card
      className={cn(
        "flex flex-col gap-3 border-border bg-card/60 p-4 transition",
        active && "border-primary/40 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="size-3 text-primary" />
            {Math.round(clip.virality)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="size-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={copyToClipboard}
            title="Copy title and reason"
          >
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {formatTime(clip.start)} - {formatTime(clip.end)}
          </span>
        </div>
      </div>
      <h4 className="text-pretty text-sm font-medium leading-snug">{clip.title}</h4>
      <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{clip.reason}</p>
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="font-mono text-xs text-muted-foreground">{duration.toFixed(1)}s</span>
        <Button size="sm" variant={active ? "default" : "secondary"} onClick={onSelect}>
          <Scissors className="size-3.5" />
          Clip
        </Button>
      </div>
    </Card>
  )
}
