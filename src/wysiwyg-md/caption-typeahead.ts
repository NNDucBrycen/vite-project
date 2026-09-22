import { Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { CAPTIONS, captionKey } from './captions'
import type { Caption } from './captions'

const MAX_RESULTS = 12

type Match = { from: number; to: number; query: string }

export interface CaptionTypeaheadHandle {
  plugin: Plugin
  close: () => void
}

function getMatch(view: EditorView): Match | null {
  const { selection } = view.state
  if (!view.editable || !view.hasFocus() || !selection.empty || !selection.$from.parent.isTextblock
    || selection.$from.parent.type.spec.code
    || view.state.schema.marks.code.isInSet(view.state.storedMarks ?? selection.$from.marks())) return null

  const before = selection.$from.parent.textBetween(0, selection.$from.parentOffset, undefined, '\ufffc')
  const match = /(?:^|\s|\(|\[)(\{[\p{L}\p{N}_. -]{0,80})$/u.exec(before)
  if (!match) return null
  return { from: selection.from - match[1].length, to: selection.from, query: match[1].slice(1) }
}

function findResults(query: string): Caption[] {
  const keyword = query.trim().toLowerCase()
  return CAPTIONS.filter((caption) =>
    !keyword || `${caption.LABEL} ${captionKey(caption)}`.toLowerCase().includes(keyword),
  ).slice(0, MAX_RESULTS)
}

export function createCaptionTypeahead(): CaptionTypeaheadHandle {
  let menu: HTMLElement | null = null
  let current: Match | null = null
  let dismissed: string | null = null
  let results: Caption[] = []
  let selectedIndex = 0
  let activeView: EditorView | null = null

  const matchKey = (match: Match) => `${match.from}:${match.to}:${match.query}`

  function close(dismiss = false): void {
    if (dismiss && current) dismissed = matchKey(current)
    current = null
    results = []
    menu?.remove()
    menu = null
  }

  function position(): void {
    if (!menu || !current || !activeView) return
    const caret = activeView.coordsAtPos(current.to)
    const padding = 8
    const gap = 8
    menu.style.visibility = 'hidden'
    menu.style.maxHeight = ''
    const height = menu.getBoundingClientRect().height
    const below = Math.max(0, window.innerHeight - caret.bottom - gap - padding)
    const above = Math.max(0, caret.top - gap - padding)
    const openAbove = below < height && above > below
    menu.style.maxHeight = `${Math.floor(openAbove ? above : below)}px`
    const bounds = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(padding, Math.min(caret.left, window.innerWidth - bounds.width - padding))}px`
    menu.style.top = `${openAbove ? caret.top - gap - bounds.height : caret.bottom + gap}px`
    menu.style.visibility = 'visible'
  }

  function select(view: EditorView, caption: Caption): void {
    if (!current) return
    const { from, to } = current
    const key = captionKey(caption)
    close()
    view.dispatch(view.state.tr.replaceWith(from, to, view.state.schema.nodes.caption.create({ key })).scrollIntoView())
    view.focus()
  }

  function highlight(): void {
    menu?.querySelectorAll('[role="option"]').forEach((item, index) => {
      item.classList.toggle('is-selected', index === selectedIndex)
      item.setAttribute('aria-selected', String(index === selectedIndex))
      if (index === selectedIndex && menu) {
        const itemRect = item.getBoundingClientRect()
        const menuRect = menu.getBoundingClientRect()
        if (itemRect.top < menuRect.top) menu.scrollTop -= menuRect.top - itemRect.top
        else if (itemRect.bottom > menuRect.bottom) menu.scrollTop += itemRect.bottom - menuRect.bottom
      }
    })
  }

  function render(view: EditorView): void {
    if (!current) return
    results = findResults(current.query)
    if (!results.length) {
      close()
      return
    }
    if (!menu) {
      menu = document.createElement('div')
      menu.className = 'wysiwyg-md-emoji-typeahead wysiwyg-md-caption-typeahead'
      menu.setAttribute('role', 'listbox')
      menu.setAttribute('aria-label', 'Label suggestions')
      document.body.append(menu)
    }
    menu.replaceChildren()
    for (const [index, caption] of results.entries()) {
      const key = captionKey(caption)
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'wysiwyg-md-emoji-typeahead-item wysiwyg-md-caption-typeahead-item'
      item.setAttribute('role', 'option')
      item.setAttribute('aria-selected', String(index === selectedIndex))
      item.title = key
      const text = document.createElement('span')
      text.className = 'wysiwyg-md-emoji-typeahead-text'
      const label = document.createElement('span')
      label.className = 'wysiwyg-md-emoji-typeahead-alias'
      label.textContent = caption.LABEL
      const code = document.createElement('span')
      code.className = 'wysiwyg-md-emoji-typeahead-description'
      code.textContent = key
      text.append(label, code)
      item.append(text)
      item.addEventListener('pointerdown', (event) => event.preventDefault())
      item.addEventListener('mouseenter', () => {
        selectedIndex = index
        highlight()
      })
      item.addEventListener('click', () => select(view, caption))
      menu.append(item)
    }
    highlight()
    position()
  }

  function update(view: EditorView): void {
    activeView = view
    const next = getMatch(view)
    if (!next) {
      dismissed = null
      close()
      return
    }
    if (matchKey(next) === dismissed) {
      close()
      return
    }
    dismissed = null
    if (!current || matchKey(current) !== matchKey(next)) selectedIndex = 0
    current = next
    render(view)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (menu && !menu.contains(event.target as Node)) close(true)
  }
  const onScroll = (event: Event) => {
    if (menu && !menu.contains(event.target as Node)) position()
  }

  const plugin = new Plugin({
    view(view) {
      activeView = view
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('scroll', onScroll, true)
      window.addEventListener('resize', position)
      return {
        update,
        destroy() {
          close()
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('resize', position)
          activeView = null
        },
      }
    },
    props: {
      handleKeyDown(view, event) {
        if (!current || event.isComposing) return false
        if (event.key === 'Escape') {
          close(true)
          return true
        }
        if (!results.length) return false
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          selectedIndex = (selectedIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length
          highlight()
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          select(view, results[selectedIndex])
          return true
        }
        return false
      },
      handleDOMEvents: {
        focus(view) {
          queueMicrotask(() => update(view))
          return false
        },
        blur() {
          close()
          return false
        },
      },
    },
  })

  return { plugin, close: () => close() }
}
