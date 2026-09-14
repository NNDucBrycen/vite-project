import { setBlockType, toggleMark, wrapIn } from 'prosemirror-commands'
import { wrapInList } from 'prosemirror-schema-list'
import type { EditorView } from 'prosemirror-view'
import {
  getActiveFontSize,
  getActiveTextColor,
  insertHorizontalRule,
  isBlockActive,
  isLinkActive,
  isMarkActive,
  isTooltipActive,
  setFontSize,
  setTextColor,
  toggleLink,
  toggleTooltip,
} from './commands'
import { startImageUpload } from './image-upload'
import { startVideoUpload } from './video-upload'
import { schema } from './schema'
import type { UploadImageFn, UploadVideoFn } from './types'

interface ToolbarButton {
  el: HTMLButtonElement
  isActive: () => boolean
}

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px']
const DEFAULT_TEXT_COLOR = '#1f2328'

export interface ToolbarHandle {
  el: HTMLElement
  update: () => void
  destroy: () => void
}

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'wysiwyg-md-toolbar-btn'
  btn.textContent = label
  btn.title = title
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    onClick()
  })
  return btn
}

export function createToolbar(
  view: EditorView,
  options: {
    uploadImage?: UploadImageFn
    onUploadError?: (error: unknown, file: File) => void
    uploadVideo?: UploadVideoFn
    onVideoUploadError?: (error: unknown, file: File) => void
  },
): ToolbarHandle {
  const el = document.createElement('div')
  el.className = 'wysiwyg-md-toolbar'
  const buttons: ToolbarButton[] = []

  function addButton(label: string, title: string, command: () => void, isActive: () => boolean) {
    const btn = button(label, title, () => {
      command()
      update()
    })
    buttons.push({ el: btn, isActive })
    el.appendChild(btn)
    return btn
  }

  addButton(
    'H1',
    'Heading 1',
    () => setBlockType(schema.nodes.heading, { level: 1 })(view.state, view.dispatch),
    () => isBlockActive(view.state, schema.nodes.heading, { level: 1 }),
  )
  addButton(
    'H2',
    'Heading 2',
    () => setBlockType(schema.nodes.heading, { level: 2 })(view.state, view.dispatch),
    () => isBlockActive(view.state, schema.nodes.heading, { level: 2 }),
  )
  addButton(
    'H3',
    'Heading 3',
    () => setBlockType(schema.nodes.heading, { level: 3 })(view.state, view.dispatch),
    () => isBlockActive(view.state, schema.nodes.heading, { level: 3 }),
  )
  addButton(
    'B',
    'Bold (Ctrl+B)',
    () => toggleMark(schema.marks.strong)(view.state, view.dispatch),
    () => isMarkActive(view.state, schema.marks.strong),
  )
  addButton(
    'I',
    'Italic (Ctrl+I)',
    () => toggleMark(schema.marks.em)(view.state, view.dispatch),
    () => isMarkActive(view.state, schema.marks.em),
  )
  addButton(
    'S',
    'Strikethrough (Ctrl+Shift+X)',
    () => toggleMark(schema.marks.strikethrough)(view.state, view.dispatch),
    () => isMarkActive(view.state, schema.marks.strikethrough),
  )
  addButton(
    '• List',
    'Bullet list',
    () => wrapInList(schema.nodes.bullet_list)(view.state, view.dispatch),
    () => isBlockActive(view.state, schema.nodes.bullet_list),
  )
  addButton(
    '1. List',
    'Ordered list',
    () => wrapInList(schema.nodes.ordered_list)(view.state, view.dispatch),
    () => isBlockActive(view.state, schema.nodes.ordered_list),
  )
  addButton(
    'Quote',
    'Blockquote',
    () => wrapIn(schema.nodes.blockquote)(view.state, view.dispatch),
    () => isBlockActive(view.state, schema.nodes.blockquote),
  )
  addButton(
    'HR',
    'Horizontal rule',
    () => insertHorizontalRule(view),
    () => false,
  )
  addButton(
    'Link',
    'Insert/remove link',
    () => toggleLink(view),
    () => isLinkActive(view.state),
  )
  addButton(
    'Tooltip',
    'Insert/remove tooltip',
    () => toggleTooltip(view),
    () => isTooltipActive(view.state),
  )

  const fontSizeSelect = document.createElement('select')
  fontSizeSelect.className = 'wysiwyg-md-toolbar-select'
  fontSizeSelect.title = 'Font size'
  const defaultSizeOption = document.createElement('option')
  defaultSizeOption.value = ''
  defaultSizeOption.textContent = 'Size'
  fontSizeSelect.appendChild(defaultSizeOption)
  for (const size of FONT_SIZES) {
    const option = document.createElement('option')
    option.value = size
    option.textContent = size
    fontSizeSelect.appendChild(option)
  }
  fontSizeSelect.addEventListener('change', () => {
    setFontSize(view, fontSizeSelect.value)
    update()
  })
  el.appendChild(fontSizeSelect)

  const textColorInput = document.createElement('input')
  textColorInput.type = 'color'
  textColorInput.className = 'wysiwyg-md-toolbar-color'
  textColorInput.title = 'Text color'
  textColorInput.value = DEFAULT_TEXT_COLOR
  textColorInput.addEventListener('input', () => {
    setTextColor(view, textColorInput.value)
    update()
  })
  el.appendChild(textColorInput)

  const clearColorBtn = button('Clear Color', 'Clear text color', () => {
    setTextColor(view, '')
    update()
  })
  el.appendChild(clearColorBtn)

  let fileInput: HTMLInputElement | null = null
  if (options.uploadImage) {
    fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = 'image/*'
    fileInput.style.display = 'none'
    fileInput.addEventListener('change', () => {
      const file = fileInput?.files?.[0]
      if (file) startImageUpload(view, file, options.uploadImage!, options.onUploadError)
      if (fileInput) fileInput.value = ''
    })
    addButton(
      'Image',
      'Insert image',
      () => fileInput?.click(),
      () => false,
    )
    el.appendChild(fileInput)
  }

  let videoFileInput: HTMLInputElement | null = null
  if (options.uploadVideo) {
    videoFileInput = document.createElement('input')
    videoFileInput.type = 'file'
    videoFileInput.accept = 'video/*'
    videoFileInput.style.display = 'none'
    videoFileInput.addEventListener('change', () => {
      const file = videoFileInput?.files?.[0]
      if (file) startVideoUpload(view, file, options.uploadVideo!, options.onVideoUploadError)
      if (videoFileInput) videoFileInput.value = ''
    })
    addButton(
      'Video',
      'Insert video',
      () => videoFileInput?.click(),
      () => false,
    )
    el.appendChild(videoFileInput)
  }

  function update() {
    for (const b of buttons) {
      b.el.classList.toggle('is-active', b.isActive())
    }
    fontSizeSelect.value = getActiveFontSize(view.state) ?? ''
    const activeColor = getActiveTextColor(view.state)
    textColorInput.value = activeColor && /^#[0-9a-f]{6}$/i.test(activeColor)
      ? activeColor
      : DEFAULT_TEXT_COLOR
  }

  update()

  return {
    el,
    update,
    destroy() {
      el.remove()
    },
  }
}
