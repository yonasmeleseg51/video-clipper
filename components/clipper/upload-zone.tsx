"use client"

import { Upload, Film } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type UploadZoneProps = {
  onFile: (file: File) => void
  disabled?: boolean
}

export function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      const file = files[0]
      if (!file.type.startsWith("video/")) return
      onFile(file)
    },
    [onFile],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (disabled) return
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-12 text-center transition",
        dragOver && "border-primary/60 bg-primary/5",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Film className="size-6" />
      </div>
      <h3 className="text-balance text-lg font-medium">Drop a video to start clipping</h3>
      <p className="mt-2 max-w-md text-pretty text-sm text-muted-foreground">
        MP4, MOV or WebM. Everything runs locally in your browser via FFmpeg.wasm. AI segment detection uses Google
        Gemini 1.5 Flash.
      </p>
      <Button
        type="button"
        className="mt-6"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Upload className="size-4" />
        Choose video
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
