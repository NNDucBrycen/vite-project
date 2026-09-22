import { setBlockType, toggleMark, wrapIn } from 'prosemirror-commands'
import { redo, undo } from 'prosemirror-history'
import { liftListItem, wrapInList } from 'prosemirror-schema-list'
import { liftTarget } from 'prosemirror-transform'
import type { EditorView } from 'prosemirror-view'
import {
  insertEmoji, insertHorizontalRule, insertTable, isBlockActive,
  isLinkActive, isMarkActive, setHighlightColor, setTextColor, toggleLink,
} from './commands'
import { startImageUpload } from './image-upload'
import { startVideoUpload } from './video-upload'
import { startFileUpload } from './file-upload'
import { schema } from './schema'
import type { UploadFileFn, UploadImageFn, UploadVideoFn } from './types'
import { positionMenu } from './node-ui'
import { openTextDialog } from './text-dialog'

export interface ToolbarHandle {
  el: HTMLElement
  update: () => void
  destroy: () => void
}

type IconName = 'chevron' | 'bold' | 'italic' | 'strike' | 'bullet'
  | 'ordered' | 'quote' | 'link' | 'plus' | 'image' | 'video' | 'file'
  | 'table' | 'diagram' | 'rule' | 'undo' | 'redo' | 'color' | 'emoji'

const iconPaths: Record<IconName, string> = {
  chevron: 'm4 6 4 4 4-4',
  bold: 'M5 2.5h3.2a2.3 2.3 0 0 1 0 4.6H5zm0 4.6h3.8a2.4 2.4 0 0 1 0 4.8H5z',
  italic: 'M10 2.5 6 13.5M7.5 2.5H13M3 13.5h5.5',
  strike: 'M11.6 4.6C10.8 3.9 9.6 3.5 8 3.5c-2 0-3 .9-3 2.2 0 2.5 6 1.3 6 4.3 0 1.5-1.3 2.5-3.2 2.5-1.5 0-2.7-.5-3.6-1.3M2.5 8h11',
  bullet: 'M6.5 4h7M6.5 8h7M6.5 12h7M2.5 4h.1M2.5 8h.1M2.5 12h.1',
  ordered: 'M7 4h6.5M7 8h6.5M7 12h6.5M2 3.5h1v2M2 9.5h1.2a.8.8 0 0 1 0 1.6H2l1.3 1.4',
  quote: 'M3 5h4v4H5l-1 2m5-6h4v4h-2l-1 2',
  link: 'M6.5 9.5 9.5 6.5M6 11.5H4.8a2.3 2.3 0 1 1 0-4.6H6M10 4.5h1.2a2.3 2.3 0 1 1 0 4.6H10',
  plus: 'M8 2.5v11M2.5 8h11',
  image: 'M2.5 3h11v10h-11zM3.5 11l3-3 2 2 2-2 2.5 3M5.5 5.7h.1',
  video: 'M2.5 3.5h11v9h-11zM7 6l3 2-3 2z',
  file: 'M4 2.5h5l3 3v8H4zM9 2.5v3h3M6 9h4M6 11h4',
  table: 'M2.5 2.5h11v11h-11zM2.5 6h11M6.2 2.5v11M9.8 2.5v11',
  diagram: 'M3 3h3v3H3zM10 2.5h3v3h-3zM9.5 10h4v3h-4zM5 6v4m0 0h4.5M11.5 5.5v4.5',
  rule: 'M2.5 8h11',
  undo: 'm5 2-3 3 3 3M2 5h7a4 4 0 0 1 0 8H5',
  redo: 'm11 2 3 3-3 3M14 5H7a4 4 0 0 0 0 8h4',
  color: 'M4 12.5 8 3l4 9.5M5.5 9.5h5',
  emoji: 'M13 8A5 5 0 1 1 3 8a5 5 0 0 1 10 0ZM5.5 9.5c1.5 2 3.5 2 5 0M6 6h.1M10 6h.1',
}

function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('wysiwyg-md-toolbar-icon')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', iconPaths[name])
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', name === 'bullet' ? '2' : '1.5')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

function button(label: string, title: string, action: () => void, iconName?: IconName): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'wysiwyg-md-toolbar-btn'
  el.title = title
  el.setAttribute('aria-label', title)
  if (iconName) el.append(icon(iconName))
  if (label) el.append(document.createTextNode(label))
  el.addEventListener('mousedown', (event) => event.preventDefault())
  el.addEventListener('click', action)
  return el
}

function separator(): HTMLElement {
  const el = document.createElement('span')
  el.className = 'wysiwyg-md-toolbar-separator'
  el.setAttribute('aria-hidden', 'true')
  return el
}

type ListName = 'bullet_list' | 'ordered_list'

function currentList(view: EditorView): { name: ListName; pos: number } | null {
  const { $from } = view.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === schema.nodes.bullet_list) {
      return { name: 'bullet_list', pos: $from.before(depth) }
    }
    if ($from.node(depth).type === schema.nodes.ordered_list) {
      return { name: 'ordered_list', pos: $from.before(depth) }
    }
  }
  return null
}

function toggleList(view: EditorView, name: ListName): boolean {
  const list = currentList(view)
  if (list?.name === name) {
    return liftListItem(schema.nodes.list_item)(view.state, view.dispatch)
  }
  if (list) {
    view.dispatch(view.state.tr.setNodeMarkup(list.pos, schema.nodes[name]).scrollIntoView())
    return true
  }
  return wrapInList(schema.nodes[name])(view.state, view.dispatch)
}

function blockquoteRange(view: EditorView) {
  const { $from, $to } = view.state.selection
  return $from.blockRange($to, (node) => node.type === schema.nodes.blockquote)
}

function toggleBlockquote(view: EditorView): boolean {
  const range = blockquoteRange(view)
  if (!range) return wrapIn(schema.nodes.blockquote)(view.state, view.dispatch)

  const target = liftTarget(range)
  if (target == null) return false
  view.dispatch(view.state.tr.lift(range, target).scrollIntoView())
  return true
}

export function createToolbar(
  view: EditorView,
  options: {
    uploadImage?: UploadImageFn
    onUploadError?: (error: unknown, file: File) => void
    uploadVideo?: UploadVideoFn
    onVideoUploadError?: (error: unknown, file: File) => void
    uploadFile?: UploadFileFn
    onFileUploadError?: (error: unknown, file: File) => void
  },
): ToolbarHandle {
  const el = document.createElement('div')
  el.className = 'wysiwyg-md-toolbar'
  const tracked: Array<{ button: HTMLButtonElement; active?: () => boolean; enabled?: () => boolean }> = []
  const menus: Array<{ wrap: HTMLElement; close: () => void }> = []

  function track(btn: HTMLButtonElement, active?: () => boolean, enabled?: () => boolean) {
    tracked.push({ button: btn, active, enabled })
    return btn
  }

  function dropdown(label: string, title: string, iconName?: IconName) {
    const wrap = document.createElement('div')
    wrap.className = 'wysiwyg-md-menu-wrap'
    const toggle = button(label, title, () => {
      const open = !menu.hidden
      closeMenus()
      if (!open) {
        menu.hidden = false
        toggle.setAttribute('aria-expanded', 'true')
        positionMenu(menu)
      }
    }, iconName)
    toggle.classList.add('wysiwyg-md-menu-toggle')
    toggle.setAttribute('aria-haspopup', 'menu')
    toggle.setAttribute('aria-expanded', 'false')
    toggle.append(icon('chevron'))
    const menu = document.createElement('div')
    menu.className = 'wysiwyg-md-menu'
    menu.setAttribute('role', 'menu')
    menu.hidden = true
    wrap.append(toggle, menu)
    menus.push({ wrap, close: () => {
      menu.hidden = true
      toggle.setAttribute('aria-expanded', 'false')
    } })
    return { wrap, toggle, menu }
  }

  function closeMenus() {
    menus.forEach((item) => item.close())
  }

  function menuItem(menu: HTMLElement, label: string, action: () => unknown, iconName?: IconName, indicator?: string) {
    const item = button(label, label, () => {
      const result = action()
      closeMenus()
      update()
      if (result instanceof Promise) void result.then(() => view.focus())
      else view.focus()
    }, iconName)
    item.classList.add('wysiwyg-md-menu-item')
    item.setAttribute('role', 'menuitem')
    if (indicator) {
      const badge = document.createElement('span')
      badge.className = 'wysiwyg-md-menu-indicator'
      badge.textContent = indicator
      item.prepend(badge)
    }
    menu.append(item)
    return item
  }

  const block = dropdown('Paragraph', 'Text style')
  block.wrap.classList.add('wysiwyg-md-block-menu')
  const blockChoices = [
    { label: 'Paragraph', indicator: '¶', command: () => setBlockType(schema.nodes.paragraph)(view.state, view.dispatch), active: () => isBlockActive(view.state, schema.nodes.paragraph) },
    ...[1, 2, 3, 4].map((level) => ({
      label: 'Heading ' + level,
      indicator: 'H' + level,
      command: () => setBlockType(schema.nodes.heading, { level })(view.state, view.dispatch),
      active: () => isBlockActive(view.state, schema.nodes.heading, { level }),
    })),
    { label: 'Code block', indicator: '</>', command: () => setBlockType(schema.nodes.code_block)(view.state, view.dispatch), active: () => isBlockActive(view.state, schema.nodes.code_block) },
  ]
  const blockItems = blockChoices.map((choice) => menuItem(block.menu, choice.label, choice.command, undefined, choice.indicator))
  el.append(block.wrap)

  function commandButton(title: string, iconName: IconName, command: () => unknown, active?: () => boolean, enabled?: () => boolean) {
    const btn = track(button('', title, () => {
      const result = command()
      update()
      if (result instanceof Promise) void result.then(() => view.focus())
      else view.focus()
    }, iconName), active, enabled)
    el.append(btn)
    return btn
  }

  commandButton('Bold (Ctrl+B)', 'bold', () => toggleMark(schema.marks.strong)(view.state, view.dispatch), () => isMarkActive(view.state, schema.marks.strong))
  commandButton('Italic (Ctrl+I)', 'italic', () => toggleMark(schema.marks.em)(view.state, view.dispatch), () => isMarkActive(view.state, schema.marks.em))
  commandButton('Strikethrough', 'strike', () => toggleMark(schema.marks.strikethrough)(view.state, view.dispatch), () => isMarkActive(view.state, schema.marks.strikethrough))
  el.append(separator())
  commandButton('Bulleted list', 'bullet', () => toggleList(view, 'bullet_list'), () => currentList(view)?.name === 'bullet_list')
  commandButton('Numbered list', 'ordered', () => toggleList(view, 'ordered_list'), () => currentList(view)?.name === 'ordered_list')
  commandButton('Blockquote', 'quote', () => toggleBlockquote(view), () => !!blockquoteRange(view))
  commandButton('Insert or remove link', 'link', () => toggleLink(view), () => isLinkActive(view.state))

  const more = dropdown('', 'More formatting')
  more.wrap.classList.add('wysiwyg-md-more-menu')
  function palette(title: string, colors: string[], apply: (color: string) => void) {
    const section = document.createElement('div')
    section.className = 'wysiwyg-md-palette-section'
    const heading = document.createElement('span')
    heading.textContent = title
    const grid = document.createElement('div')
    grid.className = 'wysiwyg-md-palette-grid'
    colors.forEach((color) => {
      const swatch = button('', title + ': ' + color, () => {
        apply(color)
        closeMenus()
        view.focus()
      })
      swatch.classList.add('wysiwyg-md-palette-swatch')
      swatch.style.backgroundColor = color
      grid.append(swatch)
    })
    section.append(heading, grid)
    more.menu.append(section)
  }
  const colors = ['#0056ff', '#ced4da', '#d32828', '#01e728', '#ffe100']
  palette('Text color', colors, (color) => setTextColor(view, color))
  palette('Highlight', colors.map((color) => color + '99'), (color) => setHighlightColor(view, color))
  const emojiSection = document.createElement('div')
  emojiSection.className = 'wysiwyg-md-palette-section'
  const emojiHeading = document.createElement('span')
  emojiHeading.textContent = 'Emoji'
  const emojiGrid = document.createElement('div')
  emojiGrid.className = 'wysiwyg-md-emoji-grid'
  for (const emoji of ['😀', '😂', '🥰', '😍', '😎', '🤔', '😢', '😭', '👍', '👏', '🙏', '🎉', '🔥', '❤️', '✅', '🚀']) {
    const emojiButton = button(emoji, 'Insert ' + emoji, () => {
      insertEmoji(view, emoji)
      closeMenus()
    })
    emojiGrid.append(emojiButton)
  }
  emojiSection.append(emojiHeading, emojiGrid)
  more.menu.append(emojiSection)
  el.append(more.wrap, separator())

  const imageInput = document.createElement('input')
  imageInput.type = 'file'
  imageInput.accept = 'image/*'
  imageInput.hidden = true
  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0]
    if (file && options.uploadImage) startImageUpload(view, file, options.uploadImage, options.onUploadError)
    imageInput.value = ''
  })
  const videoInput = document.createElement('input')
  videoInput.type = 'file'
  videoInput.accept = 'video/*'
  videoInput.hidden = true
  videoInput.addEventListener('change', () => {
    const file = videoInput.files?.[0]
    if (file && options.uploadVideo) startVideoUpload(view, file, options.uploadVideo, options.onVideoUploadError)
    videoInput.value = ''
  })
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.hidden = true
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file && options.uploadFile) startFileUpload(view, file, options.uploadFile, options.onFileUploadError)
    fileInput.value = ''
  })
  const insert = dropdown('Insert', 'Insert content', 'plus')
  insert.wrap.classList.add('wysiwyg-md-insert-menu')
  if (options.uploadImage) menuItem(insert.menu, 'Image', () => imageInput.click(), 'image')
  if (options.uploadVideo) menuItem(insert.menu, 'Video', () => videoInput.click(), 'video')
  if (options.uploadFile) menuItem(insert.menu, 'File', () => fileInput.click(), 'file')
  menuItem(insert.menu, 'Table', () => insertTable(view), 'table')
  menuItem(insert.menu, 'Table without borders', () => insertTable(view, true), 'table')
  menuItem(insert.menu, 'Diagram (Mermaid)', async () => {
    const code = await openTextDialog({
      title: 'Mermaid diagram source',
      value: 'flowchart LR\n  Start --> Review --> Done',
      multiline: true,
      confirmLabel: 'Insert diagram',
    })
    if (code == null) return
    view.dispatch(view.state.tr.replaceSelectionWith(schema.nodes.mermaid.create({ code })).scrollIntoView())
  }, 'diagram')
  const insertDivider = document.createElement('span')
  insertDivider.className = 'wysiwyg-md-menu-divider'
  insertDivider.setAttribute('role', 'separator')
  insert.menu.append(insertDivider)
  menuItem(insert.menu, 'Horizontal rule', () => insertHorizontalRule(view), 'rule')
  el.append(insert.wrap, imageInput, videoInput, fileInput, separator())

  commandButton('Undo (Ctrl+Z)', 'undo', () => undo(view.state, view.dispatch), undefined, () => undo(view.state))
  commandButton('Redo (Ctrl+Y)', 'redo', () => redo(view.state, view.dispatch), undefined, () => redo(view.state))

  function onPointerDown(event: PointerEvent) {
    if (!menus.some((item) => item.wrap.contains(event.target as Node))) closeMenus()
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeMenus()
  }
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeyDown)

  function update() {
    tracked.forEach(({ button: btn, active, enabled }) => {
      btn.classList.toggle('is-active', active?.() ?? false)
      btn.disabled = !(enabled?.() ?? true)
    })
    const current = blockChoices.findIndex((choice) => choice.active())
    block.toggle.firstChild!.textContent = blockChoices[Math.max(current, 0)].label
    blockItems.forEach((item, index) => {
      item.classList.toggle('is-active', index === current)
      item.setAttribute('aria-checked', String(index === current))
    })
  }
  update()
  return {
    el,
    update,
    destroy() {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      closeMenus()
      el.remove()
    },
  }
}
