"use client"

import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

/**
 * FFmpeg singleton. The @ffmpeg/ffmpeg v0.12 class loads the wasm core
 * inside a dedicated Web Worker, so all encoding/decoding work happens
 * off the main thread - exactly what we want on a low-power CPU.
 *
 * When SharedArrayBuffer is available (COEP/COOP headers are set we ship
 * the multi-threaded core (`@ffmpeg/core-mt`) which uses pthreads and is
 * dramatically faster. Otherwise we fall back to the single-threaded core.
 */

let ffmpegInstance: FFmpeg | null = null
let loadingPromise: Promise<FFmpeg> | null = null

export type FFmpegLogger = (message: string) => void

const MT_BASE_URL = "https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/umd"
const ST_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd"

export function isCrossOriginIsolated(): boolean {
  if (typeof window === "undefined") return false
  // crossOriginIsolated is true only when COEP+COOP are properly set
  // and SharedArrayBuffer is therefore available.
  return (window as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true
}

export async function getFFmpeg(logger?: FFmpegLogger): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg()

    if (logger) {
      ffmpeg.on("log", ({ message }) => logger(message))
    }

    const useMT = isCrossOriginIsolated()
    const baseURL = useMT ? MT_BASE_URL : ST_BASE_URL

    const loadConfig: Record<string, string> = {
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    }

    if (useMT) {
      loadConfig.workerURL = await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript")
    }

    await ffmpeg.load(loadConfig)
    ffmpegInstance = ffmpeg
    return ffmpeg
  })()

  return loadingPromise
}

export { fetchFile }
