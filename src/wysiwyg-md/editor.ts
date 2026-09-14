import { baseKeymap } from 'prosemirror-commands'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { history } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { buildInputRules } from './input-rules'
import { imagePasteDropPlugin, imageUploadPlaceholderPlugin, startImageUpload } from './image-upload'
import { createImageNodeView } from './image-node-view'
import { videoPasteDropPlugin, videoUploadPlaceholderPlugin, startVideoUpload } from './video-upload'
import { createVideoNodeView } from './video-node-view'
import { buildKeymap } from './keymap'
import { parseMarkdown, serializeMarkdown } from './markdown-io'
import { schema } from './schema'
import { createToolbar } from './toolbar'
import type { ToolbarHandle } from './toolbar'
import type { WysiwygMarkdownEditorOptions } from './types'
import './styles.css'

export class WysiwygMarkdownEditor {
  private readonly editorView: EditorView
  private readonly rootEl: HTMLElement
  private readonly mountEl: HTMLElement
  private readonly toolbarHandle: ToolbarHandle | null
  private readonly options: WysiwygMarkdownEditorOptions
  private editable: boolean

  constructor(container: HTMLElement, options: WysiwygMarkdownEditorOptions = {}) {
    this.options = options
    this.editable = options.editable ?? true

    this.rootEl = document.createElement('div')
    this.rootEl.className = 'wysiwyg-md-editor'

    this.mountEl = document.createElement('div')
    this.mountEl.className = 'wysiwyg-md-content'

    const plugins = [
      keymap(buildKeymap(schema)),
      keymap(baseKeymap),
      buildInputRules(schema),
      history(),
      dropCursor(),
      gapCursor(),
      imageUploadPlaceholderPlugin(),
      videoUploadPlaceholderPlugin(),
    ]

    if (options.uploadImage) {
      plugins.push(imagePasteDropPlugin(options.uploadImage, options.onUploadError))
    }

    if (options.uploadVideo) {
      plugins.push(videoPasteDropPlugin(options.uploadVideo, options.onVideoUploadError))
    }

    const state = EditorState.create({
      doc: parseMarkdown(options.value ?? ''),
      plugins,
    })

    this.editorView = new EditorView(this.mountEl, {
      state,
      editable: () => this.editable,
      nodeViews: {
        image: createImageNodeView(options.uploadImage, options.onUploadError),
        video: createVideoNodeView(options.uploadVideo, options.onVideoUploadError),
      },
      dispatchTransaction: (tr) => {
        const newState = this.editorView.state.apply(tr)
        this.editorView.updateState(newState)
        if (tr.docChanged) {
          this.options.onChange?.(this.getMarkdown())
        }
        this.toolbarHandle?.update()
      },
    })

    if (options.toolbar ?? true) {
      this.toolbarHandle = createToolbar(this.editorView, {
        uploadImage: options.uploadImage,
        onUploadError: options.onUploadError,
        uploadVideo: options.uploadVideo,
        onVideoUploadError: options.onVideoUploadError,
      })
      this.rootEl.appendChild(this.toolbarHandle.el)
    } else {
      this.toolbarHandle = null
    }

    this.rootEl.appendChild(this.mountEl)
    container.appendChild(this.rootEl)
  }

  getMarkdown(): string {
    return serializeMarkdown(this.editorView.state.doc)
  }

  setMarkdown(markdown: string): void {
    const doc = parseMarkdown(markdown)
    const state = EditorState.create({
      doc,
      plugins: this.editorView.state.plugins,
    })
    this.editorView.updateState(state)
  }

  insertImage(file: File): void {
    if (!this.options.uploadImage) return
    startImageUpload(this.editorView, file, this.options.uploadImage, this.options.onUploadError)
  }

  insertVideo(file: File): void {
    if (!this.options.uploadVideo) return
    startVideoUpload(this.editorView, file, this.options.uploadVideo, this.options.onVideoUploadError)
  }

  focus(): void {
    this.editorView.focus()
  }

  setEditable(editable: boolean): void {
    this.editable = editable
    this.editorView.setProps({ editable: () => this.editable })
  }

  isEmpty(): boolean {
    const doc = this.editorView.state.doc
    return doc.childCount === 1 && doc.firstChild!.isTextblock && doc.firstChild!.content.size === 0
  }

  destroy(): void {
    this.toolbarHandle?.destroy()
    this.editorView.destroy()
    this.rootEl.remove()
  }

  get view(): EditorView {
    return this.editorView
  }
}
