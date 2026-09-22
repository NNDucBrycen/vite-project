import { createMediaNodeView } from './media-node-view'
import type { UploadVideoFn } from './types'

export function createVideoNodeView(upload?: UploadVideoFn, onError?: (error: unknown, file: File) => void) {
  return createMediaNodeView('video', upload, onError)
}
