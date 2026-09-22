import type { PluginSimple } from 'markdown-it'

// Optional presentation metadata. Ordinary Markdown images remain unchanged.
export const imageMarkdownItPlugin: PluginSimple = (md) => {
  md.core.ruler.after('inline', 'image_presentation', (state) => {
    for (const block of state.tokens) {
      const tokens = block.children || []
      for (let i = 0; i < tokens.length - 1; i++) {
        const image = tokens[i]!
        const next = tokens[i + 1]!
        if (image.type !== 'image' || next.type !== 'text') continue
        const match = /^\{size=(small|medium|large|original) align=(left|center|right)\}/.exec(next.content)
        if (!match) continue
        image.attrSet('data-size', match[1]!)
        image.attrSet('data-align', match[2]!)
        next.content = next.content.slice(match[0].length)
      }
    }
  })
}
