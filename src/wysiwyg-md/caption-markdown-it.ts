import type { PluginSimple, StateInline } from 'markdown-it'
import { getCaption } from './captions'

function parseCaption(state: StateInline, silent: boolean): boolean {
  const source = state.src.slice(state.pos, state.posMax)
  const match = /^\{(?:[^{}.\s]+(?:\.[^{}.\s]+){0,3})?\}/.exec(source)
  if (!match || !getCaption(match[0])) return false

  if (!silent) {
    const token = state.push('caption', '', 0)
    token.attrSet('key', match[0])
  }
  state.pos += match[0].length
  return true
}

export const captionMarkdownItPlugin: PluginSimple = (md) => {
  md.inline.ruler.before('emphasis', 'caption', parseCaption)
}
