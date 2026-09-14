import type { PluginSimple, StateInline } from 'markdown-it'

// Process !video[title](<src>) - there is no CommonMark syntax for video,
// so this mirrors the built-in `![alt](src)` image rule with a distinct marker.
const MARKER = '!video['

function parseVideo(state: StateInline, silent: boolean): boolean {
  const start = state.pos
  const max = state.posMax

  if (state.src.slice(start, start + MARKER.length) !== MARKER) return false

  const labelStart = start + MARKER.length
  const labelEnd = state.md.helpers.parseLinkLabel(state, start + MARKER.length - 1, false)
  if (labelEnd < 0) return false

  let pos = labelEnd + 1
  if (pos >= max || state.src.charCodeAt(pos) !== 0x28 /* ( */) return false

  pos++
  for (; pos < max; pos++) {
    const code = state.src.charCodeAt(pos)
    if (code !== 0x20 && code !== 0x0a) break
  }
  if (pos >= max) return false

  const res = state.md.helpers.parseLinkDestination(state.src, pos, max)
  if (!res.ok) return false
  const href = state.md.normalizeLink(res.str)
  if (!state.md.validateLink(href)) return false
  pos = res.pos

  for (; pos < max; pos++) {
    const code = state.src.charCodeAt(pos)
    if (code !== 0x20 && code !== 0x0a) break
  }

  if (pos >= max || state.src.charCodeAt(pos) !== 0x29 /* ) */) {
    state.pos = start
    return false
  }
  pos++

  if (!silent) {
    const token = state.push('video', 'video', 0)
    token.attrs = [
      ['src', href],
      ['title', state.src.slice(labelStart, labelEnd)],
    ]
  }

  state.pos = pos
  return true
}

export const videoMarkdownItPlugin: PluginSimple = (md) => {
  md.inline.ruler.before('image', 'video', parseVideo)
}
