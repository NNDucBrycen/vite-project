import type { PluginSimple, StateInline } from 'markdown-it'

// Process %[text](18px) - a link-like mark for font size, since there is no
// CommonMark syntax for it. The marker must start with a character that
// markdown-it's inline "text" rule treats as a terminator (see
// isTerminatorChar in markdown-it/lib/rules_inline/text.mjs) - otherwise the
// text rule swallows it before this rule ever runs.
const OPEN = '%['

function parseSizeValue(src: string, start: number, max: number): { size: string; pos: number } | null {
  let pos = start
  let size = ''
  while (pos < max) {
    const code = src.charCodeAt(pos)
    if (code === 0x29 /* ) */) return { size, pos }
    size += src[pos]
    pos++
  }
  return null
}

function parseFontSize(state: StateInline, silent: boolean): boolean {
  const start = state.pos
  const max = state.posMax

  if (state.src.slice(start, start + OPEN.length) !== OPEN) return false

  const labelStart = start + OPEN.length
  const labelEnd = state.md.helpers.parseLinkLabel(state, start + OPEN.length - 1, true)
  if (labelEnd < 0) return false

  let pos = labelEnd + 1
  if (pos >= max || state.src.charCodeAt(pos) !== 0x28 /* ( */) return false
  pos++

  for (; pos < max; pos++) {
    const code = state.src.charCodeAt(pos)
    if (code !== 0x20 && code !== 0x0a) break
  }

  const parsed = parseSizeValue(state.src, pos, max)
  if (!parsed || !parsed.size) return false

  if (!silent) {
    state.pos = labelStart
    state.posMax = labelEnd

    const openToken = state.push('font_size_open', 'span', 1)
    openToken.attrs = [['size', parsed.size]]

    // `linkLevel` exists on markdown-it's runtime StateInline but is missing
    // from its type declarations.
    const stateWithLinkLevel = state as StateInline & { linkLevel: number }
    stateWithLinkLevel.linkLevel++
    state.md.inline.tokenize(state)
    stateWithLinkLevel.linkLevel--

    state.push('font_size_close', 'span', -1)
  }

  state.pos = parsed.pos + 1
  state.posMax = max
  return true
}

export const fontSizeMarkdownItPlugin: PluginSimple = (md) => {
  md.inline.ruler.before('link', 'font_size', parseFontSize)
}
