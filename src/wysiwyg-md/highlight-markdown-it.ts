import type { PluginSimple, StateInline } from 'markdown-it'

// Process ==text==, the conventional Markdown-style syntax for highlighted
// text. It is parsed as a custom mark because CommonMark has no highlight
// syntax of its own.
const MARKER = '=='

function findClosingMarker(src: string, start: number, max: number): number {
  for (let pos = start; pos < max - 1; pos++) {
    if (src.charCodeAt(pos) === 0x5c /* \\ */) {
      pos++
      continue
    }
    if (src.slice(pos, pos + MARKER.length) === MARKER) return pos
  }
  return -1
}

function parseHighlight(state: StateInline, silent: boolean): boolean {
  const start = state.pos
  const max = state.posMax
  if (state.src.slice(start, start + MARKER.length) !== MARKER) return false

  let contentStart = start + MARKER.length
  let contentEnd = findClosingMarker(state.src, contentStart, max)
  let color: string | null = null
  let end = contentEnd + MARKER.length

  // Colored highlights use ==[text](#rrggbb)== or ==[text](#rrggbbaa)==.
  // The original ==text==
  // notation remains supported for the default highlight color.
  if (state.src.charCodeAt(contentStart) === 0x5b /* [ */) {
    const colorMatch = state.src.slice(contentStart).match(/^\[([\s\S]*?)\]\((#[0-9a-f]{6}(?:[0-9a-f]{2})?)\)==/i)
    if (colorMatch) {
      contentStart++
      contentEnd = contentStart + colorMatch[1].length
      color = colorMatch[2]
      end = contentStart + colorMatch[0].length - 1
    }
  }

  if (contentEnd < 0 || contentEnd === contentStart) return false

  if (!silent) {
    state.pos = contentStart
    state.posMax = contentEnd
    const openToken = state.push('highlight_open', 'span', 1)
    if (color) openToken.attrs = [['color', color]]
    state.md.inline.tokenize(state)
    state.push('highlight_close', 'span', -1)
  }

  state.pos = end
  state.posMax = max
  return true
}

export const highlightMarkdownItPlugin: PluginSimple = (md) => {
  md.inline.ruler.before('emphasis', 'highlight', parseHighlight)
}
