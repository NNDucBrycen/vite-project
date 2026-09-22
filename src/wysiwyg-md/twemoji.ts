const TWEMOJI_BASE_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/'
const EMOJI_GRAPHEME = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|[0-9#*]\uFE0F?\u20E3/u
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export type EmojiTextPart = { text: string; emoji: boolean }

export function splitEmojiText(text: string): EmojiTextPart[] {
  const parts: EmojiTextPart[] = []
  for (const { segment } of segmenter.segment(text)) {
    if (EMOJI_GRAPHEME.test(segment)) {
      parts.push({ text: segment, emoji: true })
    } else if (parts.at(-1)?.emoji === false) {
      parts[parts.length - 1].text += segment
    } else {
      parts.push({ text: segment, emoji: false })
    }
  }
  return parts
}

function getEmojiUrl(emoji: string): string {
  const codes = Array.from(emoji, (character) => character.codePointAt(0)!)
  const hasZwj = codes.includes(0x200d)
  const filtered = hasZwj ? codes : codes.filter((code, index) => code !== 0xfe0f || codes[index + 1] === 0x20e3)
  return `${TWEMOJI_BASE_URL}${filtered.map((code) => code.toString(16)).join('-')}.svg`
}

export function createEmojiGlyph(emoji: string, inEditor = false): HTMLElement {
  const glyph = document.createElement('span')
  glyph.className = 'wysiwyg-md-emoji-glyph'
  if (inEditor) {
    glyph.dataset.emoji = emoji
    glyph.setAttribute('role', 'img')
    glyph.setAttribute('aria-label', emoji)
    glyph.contentEditable = 'false'
  } else {
    glyph.setAttribute('aria-hidden', 'true')
  }

  const native = document.createElement('span')
  native.className = 'wysiwyg-md-emoji-native'
  native.textContent = emoji

  const image = document.createElement('img')
  image.className = 'wysiwyg-md-emoji-image'
  image.src = getEmojiUrl(emoji)
  image.alt = ''
  image.decoding = 'async'
  image.loading = 'lazy'
  image.addEventListener('load', () => glyph.classList.add('is-loaded'))
  image.addEventListener('error', () => image.remove())
  glyph.append(native, image)
  return glyph
}
