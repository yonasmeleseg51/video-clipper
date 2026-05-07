import { ClipperApp } from "@/components/clipper/clipper-app"

export default function Page() {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
        <header className="mb-6 flex flex-col gap-2 md:mb-10">
          <span className="inline-flex h-6 w-fit items-center rounded-full border border-border bg-card/60 px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            FFmpeg.wasm · Gemini Flash
          </span>
          <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            ClipLogic AI
          </h1>
          <p className="max-w-2xl text-pretty text-sm text-muted-foreground">
            Drop a long video, let Gemini find the 3 most viral moments, and export keyframe-accurate
            clips - vertical 9:16 or original aspect - all without leaving the browser.
          </p>
        </header>
        <ClipperApp />
      </div>
    </main>
  )
}
