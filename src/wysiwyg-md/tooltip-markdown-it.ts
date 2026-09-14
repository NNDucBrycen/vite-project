import type { PluginSimple, StateInline } from 'markdown-it'

// Process ^[text](tooltip content) - a link-like mark whose parenthesized
// part is plain hover text rather than a URL, since there is no CommonMark
// syntax for a hover tooltip. The marker must start with a character that
// markdown-it's inline "text" rule treats as a terminator (see
// isTerminatorChar in markdown-it/lib/rules_inline/text.mjs) - otherwise the
// text rule swallows it before this rule ever runs.
const OPEN = '^['

function parseTooltipContent(
  src: string,
  start: number,
  max: number,
): { content: string; pos: number } | null {
  let pos = start
  let content = ''
  while (pos < max) {
    const code = src.charCodeAt(pos)
    if (code === 0x5c /* \ */ && pos + 1 < max) {
      content += src[pos + 1]
      pos += 2
      continue
    }
    if (code === 0x29 /* ) */) {
      return { content, pos }
    }
    content += src[pos]
    pos++
  }
  return null
}

function parseTooltip(state: StateInline, silent: boolean): boolean {
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

  const parsed = parseTooltipContent(state.src, pos, max)
  if (!parsed || !parsed.content) return false

  if (!silent) {
    state.pos = labelStart
    state.posMax = labelEnd

    const openToken = state.push('tooltip_open', 'span', 1)
    openToken.attrs = [['content', parsed.content]]

    // `linkLevel` exists on markdown-it's runtime StateInline but is missing
    // from its type declarations.
    const stateWithLinkLevel = state as StateInline & { linkLevel: number }
    stateWithLinkLevel.linkLevel++
    state.md.inline.tokenize(state)
    stateWithLinkLevel.linkLevel--

    state.push('tooltip_close', 'span', -1)
  }

  state.pos = parsed.pos + 1
  state.posMax = max
  return true
}

export const tooltipMarkdownItPlugin: PluginSimple = (md) => {
  md.inline.ruler.before('link', 'tooltip', parseTooltip)
}
