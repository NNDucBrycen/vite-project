import { Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import {
  loadEmojiList, loadRecentEmojis, recordRecentItem,
} from './emoji-picker'
import { createEmojiGlyph } from './twemoji'
import type { Emoji } from './emoji-picker'
import { createSvgIcon, getSvgIcon, SVG_ICONS, SVG_ICONS_UPDATED_EVENT } from './svg-icons'
import type { SvgIcon } from './svg-icons'

const DEFAULT_ALIASES = [
  'smile', 'joy', 'heart', 'thumbsup', 'pray', 'clap', 'sob', 'thinking',
  'fire', 'eyes', 'ok_hand', 'wave',
]
const MAX_RESULTS = 12

type Match = { from: number; to: number; query: string }
type Suggestion = { kind: 'emoji'; value: Emoji } | { kind: 'svg'; value: SvgIcon }

export interface EmojiTypeaheadHandle {
  plugin: Plugin
  close: () => void
}

function getMatch(view: EditorView): Match | null {
  const { selection } = view.state
  if (!view.editable || !view.hasFocus() || !selection.empty || !selection.$from.parent.isTextblock
    || selection.$from.parent.type.spec.code
    || view.state.schema.marks.code.isInSet(view.state.storedMarks ?? selection.$from.marks())) return null

  const { $from } = selection
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
  const match = /(?:^|[\s([{])(:[a-zA-Z0-9_+-]{0,32})$/.exec(before)
  if (!match) return null
  return { from: selection.from - match[1].length, to: selection.from, query: match[1].slice(1) }
}

function findResults(emojis: Emoji[], query: string): Suggestion[] {
  if (!query) {
    const byValue = new Map(emojis.map((emoji) => [emoji.emoji, emoji]))
    const byAlias = new Map(emojis.flatMap((emoji) => emoji.aliases.map((alias): [string, Emoji] => [alias, emoji])))
    const recent = loadRecentEmojis().map((value): Suggestion | undefined => {
      const match = /^:([A-Za-z][A-Za-z0-9_-]*):$/.exec(value)
      const icon = match && getSvgIcon(match[1])
      if (icon) return { kind: 'svg', value: icon }
      const emoji = byValue.get(value)
      return emoji ? { kind: 'emoji', value: emoji } : undefined
    })
    const defaults = DEFAULT_ALIASES.map((alias): Suggestion | undefined => {
      const emoji = byAlias.get(alias)
      return emoji ? { kind: 'emoji', value: emoji } : undefined
    })
    const seen = new Set<string>()
    return [...recent, ...defaults, ...SVG_ICONS.map((value): Suggestion => ({ kind: 'svg', value }))]
      .filter((item): item is Suggestion => {
        if (!item) return false
        const key = item.kind === 'svg' ? `:${item.value.name}:` : item.value.emoji
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, MAX_RESULTS)
  }

  const keyword = query.toLowerCase()
  const icons = SVG_ICONS.filter((icon) => icon.name.toLowerCase().includes(keyword) || icon.description.toLowerCase().includes(keyword))
    .map((value): Suggestion => ({ kind: 'svg', value }))
  const unicode = emojis.filter((emoji) =>
    emoji.description.toLowerCase().includes(keyword)
    || emoji.aliases.some((alias) => alias.toLowerCase().includes(keyword))
    || emoji.tags.some((tag) => tag.toLowerCase().includes(keyword)),
  ).map((value): Suggestion => ({ kind: 'emoji', value }))
  return [...icons, ...unicode].slice(0, MAX_RESULTS)
}

export function createEmojiTypeahead(): EmojiTypeaheadHandle {
  let menu: HTMLElement | null = null
  let current: Match | null = null
  let dismissed: string | null = null
  let results: Suggestion[] = []
  let emojis: Emoji[] | null = null
  let loading = false
  let destroyed = false
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

  function select(view: EditorView, suggestion: Suggestion): void {
    if (!current) return
    const { from, to } = current
    recordRecentItem(suggestion.kind === 'svg' ? `:${suggestion.value.name}:` : suggestion.value.emoji)
    close()
    const tr = suggestion.kind === 'svg'
      ? view.state.tr.replaceWith(from, to, view.state.schema.nodes.svg_icon.create({ name: suggestion.value.name }))
      : view.state.tr.replaceWith(from, to, view.state.schema.nodes.emoji.create({ emoji: suggestion.value.emoji }))
    view.dispatch(tr.scrollIntoView())
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
    results = findResults(emojis ?? [], current.query)
    if (emojis && results.length === 0) {
      close()
      return
    }
    if (!menu) {
      menu = document.createElement('div')
      menu.className = 'wysiwyg-md-emoji-typeahead'
      menu.setAttribute('role', 'listbox')
      menu.setAttribute('aria-label', 'Emoji suggestions')
      document.body.append(menu)
    }
    menu.replaceChildren()
    if (!emojis && results.length === 0) {
      const status = document.createElement('div')
      status.className = 'wysiwyg-md-emoji-typeahead-status'
      status.textContent = 'Loading emoji…'
      menu.append(status)
    } else {
      for (const [index, suggestion] of results.entries()) {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'wysiwyg-md-emoji-typeahead-item'
        item.setAttribute('role', 'option')
        item.setAttribute('aria-selected', String(index === selectedIndex))
        item.title = suggestion.value.description
        item.append(suggestion.kind === 'svg' ? createSvgIcon(suggestion.value.name) : createEmojiGlyph(suggestion.value.emoji))
        const text = document.createElement('span')
        text.className = 'wysiwyg-md-emoji-typeahead-text'
        const alias = document.createElement('span')
        alias.className = 'wysiwyg-md-emoji-typeahead-alias'
        alias.textContent = suggestion.kind === 'svg' ? `:${suggestion.value.name}:` : `:${suggestion.value.aliases[0]}:`
        const description = document.createElement('span')
        description.className = 'wysiwyg-md-emoji-typeahead-description'
        description.textContent = suggestion.value.description
        text.append(alias, description)
        item.append(text)
        item.addEventListener('pointerdown', (event) => event.preventDefault())
        item.addEventListener('mouseenter', () => {
          selectedIndex = index
          highlight()
        })
        item.addEventListener('click', () => select(view, suggestion))
        menu.append(item)
      }
      highlight()
    }
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
    if (emojis || loading) return
    loading = true
    void loadEmojiList().then((list) => {
      if (destroyed) return
      emojis = list
      loading = false
      update(view)
    }).catch(() => {
      if (destroyed) return
      loading = false
      close()
    })
  }

  const onPointerDown = (event: PointerEvent) => {
    if (menu && !menu.contains(event.target as Node)) close(true)
  }
  const onScroll = (event: Event) => {
    if (menu && !menu.contains(event.target as Node)) position()
  }
  const onSvgIconsUpdated = () => {
    if (activeView) update(activeView)
  }

  const plugin = new Plugin({
    view(view) {
      activeView = view
      document.addEventListener('pointerdown', onPointerDown, true)
      document.addEventListener('scroll', onScroll, true)
      window.addEventListener('resize', position)
      window.addEventListener(SVG_ICONS_UPDATED_EVENT, onSvgIconsUpdated)
      return {
        update,
        destroy() {
          destroyed = true
          close()
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('resize', position)
          window.removeEventListener(SVG_ICONS_UPDATED_EVENT, onSvgIconsUpdated)
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
