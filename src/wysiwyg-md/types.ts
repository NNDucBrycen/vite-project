export type UploadImageFn = (file: File) => Promise<string>
export type UploadVideoFn = (file: File) => Promise<string>

export interface WysiwygMarkdownEditorOptions {
  value?: string
  onChange?: (markdown: string) => void
  uploadImage?: UploadImageFn
  onUploadError?: (error: unknown, file: File) => void
  uploadVideo?: UploadVideoFn
  onVideoUploadError?: (error: unknown, file: File) => void
  toolbar?: boolean
  editable?: boolean
  placeholder?: string
}
