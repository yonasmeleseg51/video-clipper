"use client"

import {
  AlertCircle,
  Cpu,
  Download,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Wand2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { ClipCard, type Clip } from "@/components/clipper/clip-card"
import { Timeline } from "@/components/clipper/timeline"
import { UploadZone } from "@/components/clipper/upload-zone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { fetchFile, getFFmpeg, isCrossOriginIsolated } from "@/lib/ffmpeg-client"

const INPUT_NAME = "input.mp4"
const FRAME_COUNT = 8

type Status =
  | { kind: "idle" }
  | { kind: "loading-ffmpeg" }
  | { kind: "loading-video" }
  | { kind: "ready" }
  | { kind: "analyzing" }
  | { kind: "exporting"; progress: number }
  | { kind: "done"; url: string; filename: string }

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode.apply(null, Array.from(slice))
  }
  return btoa(binary)
}

export function ClipperApp() {
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [range, setRange] = useState({ start: 0, end: 0 })
  const [clips, setClips] = useState<Clip[]>([])
  const [activeClip, setActiveClip] = useState<number | null>(null)
  const [socialMode, setSocialMode] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [error, setError] = useState<string | null>(null)
  const [logLines, setLogLines] = useState<string[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const isolated = typeof window !== "undefined" ? isCrossOriginIsolated() : false

  const log = useCallback((line: string) => {
    setLogLines((prev) => [...prev.slice(-200), line])
  }, [])

  // Sync the video element time → state
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => setCurrent(v.currentTime)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)
    v.addEventListener("timeupdate", onTime)
    v.addEventListener("play", onPlay)
    v.addEventListener("pause", onPause)
    v.addEventListener("ended", onEnded)
    return () => {
      v.removeEventListener("timeupdate", onTime)
      v.removeEventListener("play", onPlay)
      v.removeEventListener("pause", onPause)
      v.removeEventListener("ended", onEnded)
    }
  }, [videoUrl])

  // Stop playback automatically when reaching the end of the selected range
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (playing && current >= range.end - 0.05 && range.end > 0) {
      v.pause()
    }
  }, [current, playing, range.end])

  const handleFile = useCallback(
    async (selected: File) => {
      setError(null)
      setClips([])
      setActiveClip(null)
      setLogLines([])
      setStatus({ kind: "loading-ffmpeg" })

      try {
        // Object URL for the <video> element
        if (videoUrl) URL.revokeObjectURL(videoUrl)
        const url = URL.createObjectURL(selected)
        setVideoUrl(url)
        setFile(selected)

        // Boot the ffmpeg worker (cached after first run)
        const ffmpeg = await getFFmpeg(log)

        setStatus({ kind: "loading-video" })
        await ffmpeg.writeFile(INPUT_NAME, await fetchFile(selected))
        setStatus({ kind: "ready" })
      } catch (e) {
        console.error("[v0] ffmpeg load failed:", e)
        setError(e instanceof Error ? e.message : "Failed to load FFmpeg")
        setStatus({ kind: "idle" })
      }
    },
    [log, videoUrl],
  )

  const handleLoadedMetadata = () => {
    const v = videoRef.current
    if (!v) return
    const d = v.duration
    setDuration(d)
    setRange({ start: 0, end: Math.min(d, 30) })
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (v.currentTime < range.start || v.currentTime >= range.end) {
        v.currentTime = range.start
      }
      void v.play()
    } else {
      v.pause()
    }
  }

  const seek = (t: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = t
    setCurrent(t)
  }

  const analyze = async () => {
    if (!file || duration <= 0) return
    setError(null)
    setStatus({ kind: "analyzing" })

    try {
      const ffmpeg = await getFFmpeg(log)
      const frames: { timestamp: number; base64: string }[] = []

      // Extract evenly spaced frames. Avoid the very first and very last.
      const step = duration / (FRAME_COUNT + 1)
      for (let i = 1; i <= FRAME_COUNT; i++) {
        const ts = step * i
        const out = `frame_${i}.jpg`
        await ffmpeg.exec([
          "-ss",
          ts.toFixed(2),
          "-i",
          INPUT_NAME,
          "-frames:v",
          "1",
          "-vf",
          "scale=512:-2",
          "-q:v",
          "4",
          out,
        ])
        const data = (await ffmpeg.readFile(out)) as Uint8Array
        const base64 = `data:image/jpeg;base64,${uint8ToBase64(data)}`
        frames.push({ timestamp: ts, base64 })
        await ffmpeg.deleteFile(out)
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration, frames }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.error ?? `Analyze failed (${res.status})`)
      }
      const { clips: aiClips } = (await res.json()) as { clips: Clip[] }
      setClips(aiClips)
      if (aiClips.length > 0) {
        setActiveClip(0)
        setRange({ start: aiClips[0].start, end: aiClips[0].end })
        seek(aiClips[0].start)
      }
      setStatus({ kind: "ready" })
    } catch (e) {
      console.error("[v0] analyze error:", e)
      setError(e instanceof Error ? e.message : "Analysis failed")
      setStatus({ kind: "ready" })
    }
  }

  const selectClip = (i: number) => {
    const c = clips[i]
    if (!c) return
    setActiveClip(i)
    setRange({ start: c.start, end: c.end })
    seek(c.start)
  }

  const exportClip = async () => {
    if (!file) return
    setError(null)
    setStatus({ kind: "exporting", progress: 0 })

    try {
      const ffmpeg = await getFFmpeg(log)
      const outName = socialMode ? "out.mp4" : "out.mp4"

      const onProgress = ({ progress }: { progress: number }) => {
        setStatus({ kind: "exporting", progress })
      }
      ffmpeg.on("progress", onProgress)

      const args = socialMode
        ? [
            "-ss",
            range.start.toFixed(2),
            "-to",
            range.end.toFixed(2),
            "-i",
            INPUT_NAME,
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            outName,
          ]
        : [
            // Fast stream-copy clip - keyframe aligned.
            "-ss",
            range.start.toFixed(2),
            "-to",
            range.end.toFixed(2),
            "-i",
            INPUT_NAME,
            "-c",
            "copy",
            outName,
          ]

      await ffmpeg.exec(args)
      const data = (await ffmpeg.readFile(outName)) as Uint8Array
      ffmpeg.off("progress", onProgress)

      const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" })
      const url = URL.createObjectURL(blob)
      const safeName = file.name.replace(/\.[^.]+$/, "")
      const filename = `${safeName}-clip-${Math.round(range.start)}-${Math.round(range.end)}${
        socialMode ? "-vertical" : ""
      }.mp4`

      // Trigger a download immediately and keep the link in state for the UI
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()

      setStatus({ kind: "done", url, filename })
      try {
        await ffmpeg.deleteFile(outName)
      } catch {
        // ignore cleanup errors
      }
    } catch (e) {
      console.error("[v0] export error:", e)
      setError(e instanceof Error ? e.message : "Export failed")
      setStatus({ kind: "ready" })
    }
  }

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    if (status.kind === "done") URL.revokeObjectURL(status.url)
    setFile(null)
    setVideoUrl(null)
    setDuration(0)
    setCurrent(0)
    setRange({ start: 0, end: 0 })
    setClips([])
    setActiveClip(null)
    setStatus({ kind: "idle" })
    setError(null)
    setLogLines([])
  }

  const isBusy =
    status.kind === "loading-ffmpeg" ||
    status.kind === "loading-video" ||
    status.kind === "analyzing" ||
    status.kind === "exporting"

  const statusLabel =
    status.kind === "loading-ffmpeg"
      ? "Booting FFmpeg worker..."
      : status.kind === "loading-video"
        ? "Loading video into FFmpeg..."
        : status.kind === "analyzing"
          ? "Gemini is analyzing frames..."
          : status.kind === "exporting"
            ? `Exporting... ${Math.round(status.progress * 100)}%`
            : status.kind === "done"
              ? "Export ready"
              : status.kind === "ready"
                ? "Ready"
                : "Idle"

  return (
    <div className="flex flex-col gap-6">
      {/* Top status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Cpu className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-tight">ClipLogic AI</span>
            <span className="font-mono text-xs text-muted-foreground">
              FFmpeg worker {isolated ? "multi-threaded" : "single-threaded"} · Gemini Flash
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs">
            {statusLabel}
          </Badge>
          {file && (
            <Button size="sm" variant="ghost" onClick={reset} disabled={isBusy}>
              <X className="size-4" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-foreground">
          <AlertCircle className="mt-0.5 size-4 text-destructive" />
          <div className="flex-1">
            <div className="font-medium text-destructive">Something went wrong</div>
            <div className="text-destructive/90">{error}</div>
          </div>
        </div>
      )}

      {!videoUrl ? (
        <UploadZone onFile={handleFile} disabled={isBusy} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Player + timeline */}
          <div className="flex flex-col gap-4">
            <Card className="overflow-hidden border-border bg-black p-0">
              <div className="relative aspect-video w-full bg-black">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={handleLoadedMetadata}
                  className="h-full w-full"
                  playsInline
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/60 p-3">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={togglePlay} disabled={duration === 0}>
                    {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {playing ? "Pause" : "Play"}
                  </Button>
                  <span className="font-mono text-xs text-muted-foreground">
                    {file?.name ?? ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="social-mode"
                      checked={socialMode}
                      onCheckedChange={setSocialMode}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Label htmlFor="social-mode" className="text-xs">
                      Social mode 9:16
                    </Label>
                  </div>
                  <Button size="sm" onClick={exportClip} disabled={isBusy || duration === 0}>
                    {status.kind === "exporting" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Export clip
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="border-border bg-card/40 p-4">
              <Timeline
                duration={duration}
                current={current}
                start={range.start}
                end={range.end}
                onSeek={seek}
                onRangeChange={setRange}
              />
            </Card>

            {/* Log panel */}
            <Card className="border-border bg-card/40 p-0">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  ffmpeg log
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {logLines.length} lines
                </span>
              </div>
              <div className="max-h-40 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
                {logLines.length === 0 ? (
                  <div className="text-muted-foreground/60">Waiting for ffmpeg...</div>
                ) : (
                  logLines.slice(-80).map((l, i) => <div key={i}>{l}</div>)
                )}
              </div>
            </Card>
          </div>

          {/* Right column - AI clips */}
          <div className="flex flex-col gap-4">
            <Card className="border-border bg-card/40 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="text-sm font-medium">Viral segments</span>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  Gemini Flash
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                We sample {FRAME_COUNT} keyframes and ask Gemini to pick the 3 best short-form clips.
              </p>
              <Button
                className="mt-4 w-full"
                onClick={analyze}
                disabled={isBusy || duration === 0}
              >
                {status.kind === "analyzing" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                {clips.length > 0 ? "Re-analyze" : "Find viral clips"}
              </Button>
            </Card>

            <div className="flex flex-col gap-3">
              {clips.length === 0 && status.kind !== "analyzing" && (
                <Card className="border-dashed border-border bg-card/20 p-4 text-center text-xs text-muted-foreground">
                  No clips yet. Run analysis to get 3 AI suggestions.
                </Card>
              )}
              {clips.map((c, i) => (
                <ClipCard
                  key={i}
                  index={i}
                  clip={c}
                  active={activeClip === i}
                  onSelect={() => selectClip(i)}
                />
              ))}
            </div>

            {status.kind === "done" && (
              <Card className="border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Download className="size-4 text-primary" />
                  Export ready
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {status.filename}
                </p>
                <a
                  href={status.url}
                  download={status.filename}
                  className="mt-3 inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Download again
                </a>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
