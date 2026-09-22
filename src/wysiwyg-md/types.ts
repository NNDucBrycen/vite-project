export type UploadImageFn = (file: File) => Promise<string>
export type UploadVideoFn = (file: File) => Promise<string>
export type UploadFileFn = (file: File) => Promise<string>
export type MarkdownEditorMode = 'display' | 'raw' | 'preview'

export interface WysiwygMarkdownEditorOptions {
  value?: string
  mode?: MarkdownEditorMode
  onChange?: (markdown: string) => void
  uploadImage?: UploadImageFn
  onUploadError?: (error: unknown, file: File) => void
  uploadVideo?: UploadVideoFn
  onVideoUploadError?: (error: unknown, file: File) => void
  /** Uploads an attachment and resolves to its public URL. */
  uploadFile?: UploadFileFn
  onFileUploadError?: (error: unknown, file: File) => void
  toolbar?: boolean
  editable?: boolean
  placeholder?: string
}
