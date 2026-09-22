import { positionMenu } from './node-ui'
import { createSvgIcon, getSvgIcon, SVG_ICONS, SVG_ICONS_UPDATED_EVENT } from './svg-icons'
import type { SvgIcon } from './svg-icons'
import { createEmojiGlyph } from './twemoji'

export type Emoji = {
  emoji: string
  description: string
  category: string
  aliases: string[]
  tags: string[]
}

export type EmojiPickerSelection =
  | { kind: 'emoji'; emoji: string }
  | { kind: 'svg'; name: string }

type PickerItem = { kind: 'emoji'; value: Emoji } | { kind: 'svg'; value: SvgIcon }

export interface EmojiPickerHandle {
  wrap: HTMLElement
  open: () => void
  close: () => void
  isOpen: () => boolean
  destroy: () => void
}

const RECENT_EMOJI_STORAGE_KEY = 'wysiwyg_md_recent_emojis'
export const MAX_RECENT_EMOJIS = 24
const VISIBLE_BATCH_SIZE = 120

const CATEGORY_ORDER = [
  'Smileys & Emotion',
  'People & Body',
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
] as const

const CATEGORY_ICON_ALIASES: Record<string, string> = {
  'Smileys & Emotion': 'smile',
  'People & Body': 'wave',
  'Animals & Nature': 'dog',
  'Food & Drink': 'apple',
  'Travel & Places': 'car',
  Activities: 'soccer',
  Objects: 'bulb',
  Symbols: 'heart',
  Flags: 'jp',
}

// Match the initial Frequent section in endeavor_fe's EmojiFloatingPicker.
const FALLBACK_FREQUENT_ALIASES = [
  'wave', '+1', 'bow', 'smile', 'eyes', 'pray', 'thinking', 'joy',
  'tada', 'sweat_smile', 'clap', 'heart_eyes',
]

let emojiListPromise: Promise<Emoji[]> | null = null

export function loadEmojiList(): Promise<Emoji[]> {
  if (!emojiListPromise) {
    emojiListPromise = import('./emoji-list')
      .then((module) => module.default as Emoji[])
      .catch((error: unknown) => {
        emojiListPromise = null
        throw error
      })
  }
  return emojiListPromise
}

export function loadRecentEmojis(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_EMOJI_STORAGE_KEY) ?? '[]') as unknown
    return Array.isArray(value) ? value.filter((emoji): emoji is string => typeof emoji === 'string').slice(0, MAX_RECENT_EMOJIS) : []
  } catch {
    return []
  }
}

export function saveRecentEmojis(emojis: string[]): void {
  try {
    localStorage.setItem(RECENT_EMOJI_STORAGE_KEY, JSON.stringify(emojis))
  } catch {
    // Storage can be disabled without affecting emoji insertion.
  }
}

export function recordRecentItem(value: string): string[] {
  const recents = loadRecentEmojis()
  const updated = [value, ...recents.filter((item) => item !== value)].slice(0, MAX_RECENT_EMOJIS)
  saveRecentEmojis(updated)
  return updated
}

export function createEmojiPicker(trigger: HTMLButtonElement, onSelect: (selection: EmojiPickerSelection) => void): EmojiPickerHandle {
  const wrap = document.createElement('div')
  wrap.className = 'wysiwyg-md-menu-wrap wysiwyg-md-emoji-picker-wrap'
  trigger.setAttribute('aria-haspopup', 'dialog')
  trigger.setAttribute('aria-expanded', 'false')

  const panel = document.createElement('div')
  panel.className = 'wysiwyg-md-emoji-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Emoji picker')
  panel.hidden = true

  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'wysiwyg-md-emoji-search'
  search.placeholder = 'Search emoji'
  search.setAttribute('aria-label', 'Search emoji')

  const tabs = document.createElement('div')
  tabs.className = 'wysiwyg-md-emoji-tabs'
  tabs.setAttribute('role', 'tablist')
  tabs.setAttribute('aria-label', 'Emoji categories')

  const body = document.createElement('div')
  body.className = 'wysiwyg-md-emoji-body'
  panel.append(search, tabs, body)
  wrap.append(trigger, panel)

  let emojis: Emoji[] = []
  let byAlias = new Map<string, Emoji>()
  let byValue = new Map<string, Emoji>()
  let byCategory = new Map<string, Emoji[]>()
  let recentItems: string[] = []
  let activeCategory = 'frequent'
  let visibleCount = VISIBLE_BATCH_SIZE
  let loading = false
  let loadFailed = false
  let destroyed = false
  let matchingCount = 0

  function frequentItems(): PickerItem[] {
    const recent = recentItems.map((value): PickerItem | undefined => {
      const match = /^:([A-Za-z][A-Za-z0-9_-]*):$/.exec(value)
      const icon = match && getSvgIcon(match[1])
      if (icon) return { kind: 'svg', value: icon }
      const emoji = byValue.get(value)
      return emoji ? { kind: 'emoji', value: emoji } : undefined
    })
    const fallback = FALLBACK_FREQUENT_ALIASES.map((alias): PickerItem | undefined => {
      const emoji = byAlias.get(alias)
      return emoji ? { kind: 'emoji', value: emoji } : undefined
    })
    const seen = new Set<string>()
    return [...recent, ...fallback].filter((item): item is PickerItem => {
      if (!item) return false
      const key = item.kind === 'svg' ? `:${item.value.name}:` : item.value.emoji
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  function renderTabs(): void {
    tabs.replaceChildren()
    for (const category of ['frequent', 'svg', ...CATEGORY_ORDER]) {
      if (category !== 'frequent' && category !== 'svg' && !byCategory.has(category)) continue
      const tab = document.createElement('button')
      tab.type = 'button'
      tab.className = 'wysiwyg-md-emoji-tab'
      tab.classList.toggle('is-svg', category === 'svg')
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-label', category === 'frequent' ? 'Frequently used' : category === 'svg' ? 'SVG icons' : category)
      tab.setAttribute('aria-selected', String(category === activeCategory))
      tab.title = category === 'frequent' ? 'Frequently used' : category === 'svg' ? 'SVG icons' : category
      if (category === 'frequent') {
        tab.textContent = '★'
      } else if (category === 'svg') {
        tab.textContent = 'SVG'
      } else {
        const icon = byAlias.get(CATEGORY_ICON_ALIASES[category])?.emoji ?? byCategory.get(category)?.[0]?.emoji
        if (icon) tab.append(createEmojiGlyph(icon))
      }
      tab.addEventListener('mousedown', (event) => event.preventDefault())
      tab.addEventListener('click', () => {
        activeCategory = category
        visibleCount = VISIBLE_BATCH_SIZE
        renderTabs()
        renderBody()
        body.scrollTop = 0
      })
      tabs.append(tab)
    }
  }

  function matchingItems(): PickerItem[] {
    const keyword = search.value.trim().toLowerCase()
    if (activeCategory === 'svg') {
      return SVG_ICONS.filter((icon) => !keyword || icon.name.toLowerCase().includes(keyword) || icon.description.toLowerCase().includes(keyword))
        .map((value): PickerItem => ({ kind: 'svg', value }))
    }
    if (!keyword && activeCategory === 'frequent') return frequentItems()
    const matches = keyword
      ? emojis.filter((emoji) =>
        emoji.description.toLowerCase().includes(keyword)
        || emoji.aliases.some((alias) => alias.toLowerCase().includes(keyword))
        || emoji.tags.some((tag) => tag.toLowerCase().includes(keyword)),
      )
      : byCategory.get(activeCategory) ?? []
    return matches.map((value): PickerItem => ({ kind: 'emoji', value }))
  }

  function renderBody(): void {
    body.replaceChildren()
    tabs.hidden = !!search.value.trim()

    if (activeCategory !== 'svg' && (loading || loadFailed)
      && !(activeCategory === 'frequent' && frequentItems().length > 0)) {
      const message = document.createElement('div')
      message.className = 'wysiwyg-md-emoji-message'
      message.textContent = loading ? 'Loading emoji…' : 'Could not load emoji. Reopen to retry.'
      body.append(message)
      return
    }

    const results = matchingItems()
    matchingCount = results.length
    const heading = document.createElement('div')
    heading.className = 'wysiwyg-md-emoji-heading'
    heading.textContent = activeCategory === 'svg'
      ? search.value.trim() ? 'Search SVG icons' : 'SVG icons'
      : search.value.trim() ? 'Search results' : activeCategory === 'frequent' ? 'Frequently used' : activeCategory
    body.append(heading)

    if (results.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'wysiwyg-md-emoji-message'
      empty.textContent = activeCategory === 'svg' ? 'No SVG icons found' : 'No emoji found'
      body.append(empty)
      return
    }

    const grid = document.createElement('div')
    grid.className = 'wysiwyg-md-emoji-results'
    for (const result of results.slice(0, visibleCount)) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'wysiwyg-md-emoji-item'
      item.title = result.kind === 'svg' ? `:${result.value.name}:` : result.value.description
      item.setAttribute('aria-label', result.kind === 'svg' ? `:${result.value.name}:` : result.value.description)
      item.append(result.kind === 'svg' ? createSvgIcon(result.value.name) : createEmojiGlyph(result.value.emoji))
      item.addEventListener('mousedown', (event) => event.preventDefault())
      item.addEventListener('click', () => {
        recentItems = recordRecentItem(result.kind === 'svg' ? `:${result.value.name}:` : result.value.emoji)
        close()
        onSelect(result.kind === 'svg' ? { kind: 'svg', name: result.value.name } : { kind: 'emoji', emoji: result.value.emoji })
      })
      grid.append(item)
    }
    body.append(grid)

    if (visibleCount < results.length) {
      const more = document.createElement('button')
      more.type = 'button'
      more.className = 'wysiwyg-md-emoji-more'
      more.textContent = 'Show more'
      more.addEventListener('click', () => {
        visibleCount += VISIBLE_BATCH_SIZE
        renderBody()
      })
      body.append(more)
    }
  }

  function close(): void {
    panel.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
  }

  function open(): void {
    panel.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    search.value = ''
    activeCategory = 'frequent'
    visibleCount = VISIBLE_BATCH_SIZE
    recentItems = loadRecentEmojis()
    renderTabs()
    renderBody()
    positionMenu(panel)
    search.focus()

    if (emojis.length || loading) return
    loading = true
    loadFailed = false
    renderBody()
    void loadEmojiList().then((list) => {
      if (destroyed) return
      emojis = list
      byAlias = new Map(list.flatMap((emoji) => emoji.aliases.map((alias): [string, Emoji] => [alias, emoji])))
      byValue = new Map(list.map((emoji) => [emoji.emoji, emoji]))
      byCategory = new Map(CATEGORY_ORDER.map((category) => [category, list.filter((emoji) => emoji.category === category)]))
      loading = false
      renderTabs()
      renderBody()
      if (!panel.hidden) positionMenu(panel)
    }).catch(() => {
      if (destroyed) return
      loading = false
      loadFailed = true
      renderBody()
    })
  }

  search.addEventListener('input', () => {
    visibleCount = VISIBLE_BATCH_SIZE
    renderBody()
    body.scrollTop = 0
  })
  body.addEventListener('scroll', () => {
    if (visibleCount >= matchingCount || body.scrollHeight - body.scrollTop - body.clientHeight > 96) return
    visibleCount += VISIBLE_BATCH_SIZE
    renderBody()
  })
  const onResize = () => {
    if (!panel.hidden) positionMenu(panel)
  }
  const onSvgIconsUpdated = () => {
    if (panel.hidden) return
    renderTabs()
    renderBody()
    positionMenu(panel)
  }
  window.addEventListener('resize', onResize)
  window.addEventListener(SVG_ICONS_UPDATED_EVENT, onSvgIconsUpdated)

  return {
    wrap,
    open,
    close,
    isOpen: () => !panel.hidden,
    destroy: () => {
      destroyed = true
      window.removeEventListener('resize', onResize)
      window.removeEventListener(SVG_ICONS_UPDATED_EVENT, onSvgIconsUpdated)
      close()
      wrap.remove()
    },
  }
}
