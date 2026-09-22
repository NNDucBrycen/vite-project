import { createMediaNodeView } from './media-node-view'
import type { UploadImageFn } from './types'

export function createImageNodeView(upload?: UploadImageFn, onError?: (error: unknown, file: File) => void) {
  return createMediaNodeView('image', upload, onError)
}
