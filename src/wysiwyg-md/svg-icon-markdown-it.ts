import type { PluginSimple, StateInline } from 'markdown-it'
import { getSvgIcon } from './svg-icons'

function parseSvgIcon(state: StateInline, silent: boolean): boolean {
  const source = state.src.slice(state.pos, state.posMax)
  const match = /^:([A-Za-z][A-Za-z0-9_-]*):/.exec(source)
  if (!match || !getSvgIcon(match[1])) return false

  if (!silent) {
    const token = state.push('svg_icon', '', 0)
    token.attrSet('name', match[1])
  }
  state.pos += match[0].length
  return true
}

export const svgIconMarkdownItPlugin: PluginSimple = (md) => {
  md.inline.ruler.before('emphasis', 'svg_icon', parseSvgIcon)
}
