import { baseKeymap } from 'prosemirror-commands'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { tableEditing } from 'prosemirror-tables'
import { closeHistory, history } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { buildInputRules } from './input-rules'
import { createBlockDragHandle } from './block-drag-handle'
import type { BlockDragHandle } from './block-drag-handle'
import { imagePasteDropPlugin, imageUploadPlaceholderPlugin, startImageUpload } from './image-upload'
import { createImageNodeView } from './image-node-view'
import { filePasteDropPlugin, fileUploadPlaceholderPlugin, startFileUpload } from './file-upload'
import { videoPasteDropPlugin, videoUploadPlaceholderPlugin, startVideoUpload } from './video-upload'
import { createVideoNodeView } from './video-node-view'
import { buildKeymap } from './keymap'
import { insertEmoji } from './commands'
import { parseMarkdown, serializeMarkdown } from './markdown-io'
import { schema } from './schema'
import { createToolbar } from './toolbar'
import { createTableNodeView } from './table-node-view'
import { createMermaidNodeView } from './mermaid-node-view'
import type { ToolbarHandle } from './toolbar'
import type { MarkdownEditorMode, WysiwygMarkdownEditorOptions } from './types'
import './styles.css'

export class WysiwygMarkdownEditor {
  private readonly editorView: EditorView
  private readonly rootEl: HTMLElement
  private readonly mountEl: HTMLElement
  private readonly rawEl: HTMLTextAreaElement
  private readonly modeButtons: Record<MarkdownEditorMode, HTMLButtonElement>
  private readonly fullscreenButton: HTMLButtonElement
  private readonly toolbarHandle: ToolbarHandle | null
  private readonly blockDragHandle: BlockDragHandle
  private readonly options: WysiwygMarkdownEditorOptions
  private editable: boolean
  private mode: MarkdownEditorMode = 'display'

  constructor(container: HTMLElement, options: WysiwygMarkdownEditorOptions = {}) {
    this.options = options
    this.editable = options.editable ?? true

    this.rootEl = document.createElement('div')
    this.rootEl.className = 'wysiwyg-md-editor'
    this.rootEl.classList.toggle('is-readonly', !this.editable)

    const modeControls = document.createElement('div')
    modeControls.className = 'wysiwyg-md-mode-controls'
    const makeModeButton = (mode: MarkdownEditorMode, label: string) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'wysiwyg-md-mode-button'
      button.textContent = label
      button.addEventListener('click', () => this.setMode(mode))
      modeControls.append(button)
      return button
    }
    this.modeButtons = {
      display: makeModeButton('display', 'Visual editor'),
      raw: makeModeButton('raw', 'Markdown'),
      preview: makeModeButton('preview', 'Preview'),
    }
    this.fullscreenButton = document.createElement('button')
    this.fullscreenButton.type = 'button'
    this.fullscreenButton.className = 'wysiwyg-md-fullscreen-button'
    this.fullscreenButton.title = 'Toggle fullscreen'
    this.fullscreenButton.setAttribute('aria-label', 'Toggle fullscreen')
    this.fullscreenButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2.5H2.5V6M10 2.5h3.5V6M2.5 10v3.5H6M13.5 10v3.5H10"/></svg>'
    this.fullscreenButton.addEventListener('click', () => {
      this.rootEl.classList.toggle('is-fullscreen')
      this.fullscreenButton.setAttribute('aria-pressed', String(this.rootEl.classList.contains('is-fullscreen')))
    })
    modeControls.append(this.fullscreenButton)

    this.rawEl = document.createElement('textarea')
    this.rawEl.className = 'wysiwyg-md-raw'
    this.rawEl.setAttribute('aria-label', 'Raw Markdown')
    this.rawEl.spellcheck = false
    this.rawEl.readOnly = !this.editable
    this.rawEl.placeholder = options.placeholder ?? 'Write Markdown…'
    this.rawEl.value = options.value ?? ''
    this.rawEl.hidden = true
    this.rawEl.addEventListener('input', () => {
      const doc = parseMarkdown(this.rawEl.value)
      if (doc.eq(this.editorView.state.doc)) {
        this.options.onChange?.(this.getMarkdown())
        return
      }
      this.editorView.dispatch(
        this.editorView.state.tr
          .replaceWith(0, this.editorView.state.doc.content.size, doc.content)
          .setMeta('rawMarkdownInput', true),
      )
    })

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
      fileUploadPlaceholderPlugin(),
      tableEditing(),
    ]

    if (options.uploadImage) {
      plugins.push(imagePasteDropPlugin(options.uploadImage, options.onUploadError))
    }

    if (options.uploadVideo) {
      plugins.push(videoPasteDropPlugin(options.uploadVideo, options.onVideoUploadError))
    }

    if (options.uploadFile) {
      plugins.push(filePasteDropPlugin(options.uploadFile, options.onFileUploadError))
    }

    const state = EditorState.create({
      doc: parseMarkdown(options.value ?? ''),
      plugins,
    })

    this.editorView = new EditorView(this.mountEl, {
      state,
      editable: () => this.editable,
      nodeViews: {
        table: createTableNodeView,
        mermaid: createMermaidNodeView,
        image: createImageNodeView(options.uploadImage, options.onUploadError),
        video: createVideoNodeView(options.uploadVideo, options.onVideoUploadError),
      },
      dispatchTransaction: (tr) => {
        const newState = this.editorView.state.apply(tr)
        this.editorView.updateState(newState)
        if (tr.docChanged) {
          this.blockDragHandle?.reset()
          if (!tr.getMeta('rawMarkdownInput')) {
            this.rawEl.value = serializeMarkdown(newState.doc)
          }
          this.options.onChange?.(this.getMarkdown())
        }
        this.toolbarHandle?.update()
      },
    })

    this.blockDragHandle = createBlockDragHandle(this.editorView, this.mountEl)

    if (options.toolbar ?? true) {
      this.toolbarHandle = createToolbar(this.editorView, {
        uploadImage: options.uploadImage,
        onUploadError: options.onUploadError,
        uploadVideo: options.uploadVideo,
        onVideoUploadError: options.onVideoUploadError,
        uploadFile: options.uploadFile,
        onFileUploadError: options.onFileUploadError,
      })
      this.toolbarHandle.el.appendChild(modeControls)
      this.rootEl.appendChild(this.toolbarHandle.el)
    } else {
      this.toolbarHandle = null
      this.rootEl.appendChild(modeControls)
    }

    this.rootEl.appendChild(this.mountEl)
    this.rootEl.appendChild(this.rawEl)
    container.appendChild(this.rootEl)
    this.setMode(options.mode ?? 'display')
  }

  getMarkdown(): string {
    return this.rawEl.value
  }

  getMode(): MarkdownEditorMode {
    return this.mode
  }

  setMode(mode: MarkdownEditorMode): void {
    if (this.mode !== mode) this.editorView.dispatch(closeHistory(this.editorView.state.tr))
    this.mode = mode
    this.mountEl.hidden = mode === 'raw'
    this.rawEl.hidden = mode !== 'raw'
    this.rootEl.classList.toggle('is-preview', mode === 'preview')
    this.editorView.setProps({ editable: () => this.editable && this.mode !== 'preview' })
    this.blockDragHandle.reset()
    this.toolbarHandle?.el.classList.toggle('is-view-only', mode !== 'display')
    this.updateModeButtons()
  }

  private updateModeButtons(): void {
    for (const [mode, button] of Object.entries(this.modeButtons)) {
      const active = mode === this.mode
      button.classList.toggle('is-active', active)
      button.setAttribute('aria-pressed', String(active))
    }
  }

  setMarkdown(markdown: string): void {
    const doc = parseMarkdown(markdown)
    const state = EditorState.create({
      doc,
      plugins: this.editorView.state.plugins,
    })
    this.editorView.updateState(state)
    this.blockDragHandle.reset()
    this.rawEl.value = markdown
    this.toolbarHandle?.update()
  }

  insertImage(file: File): void {
    if (!this.options.uploadImage) return
    startImageUpload(this.editorView, file, this.options.uploadImage, this.options.onUploadError)
  }

  insertVideo(file: File): void {
    if (!this.options.uploadVideo) return
    startVideoUpload(this.editorView, file, this.options.uploadVideo, this.options.onVideoUploadError)
  }

  insertFile(file: File): void {
    if (!this.options.uploadFile) return
    startFileUpload(this.editorView, file, this.options.uploadFile, this.options.onFileUploadError)
  }

  /** Inserts a Unicode emoji at the current cursor or replaces the current selection. */
  insertEmoji(emoji: string): void {
    insertEmoji(this.editorView, emoji)
  }

  focus(): void {
    if (this.mode === 'raw') this.rawEl.focus()
    else if (this.mode === 'display') this.editorView.focus()
  }

  setEditable(editable: boolean): void {
    this.editable = editable
    this.rootEl.classList.toggle('is-readonly', !editable)
    this.rawEl.readOnly = !editable
    this.editorView.setProps({ editable: () => this.editable && this.mode !== 'preview' })
    this.blockDragHandle.reset()
  }

  isEmpty(): boolean {
    const doc = this.editorView.state.doc
    return doc.childCount === 1 && doc.firstChild!.isTextblock && doc.firstChild!.content.size === 0
  }

  destroy(): void {
    this.blockDragHandle.destroy()
    this.toolbarHandle?.destroy()
    this.editorView.destroy()
    this.rootEl.remove()
  }

  get view(): EditorView {
    return this.editorView
  }
}
