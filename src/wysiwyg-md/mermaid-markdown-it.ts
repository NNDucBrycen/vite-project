import type { PluginSimple } from 'markdown-it'

/** Marks Mermaid fenced code blocks so ProseMirror can render them as diagrams. */
export const mermaidMarkdownItPlugin: PluginSimple = (md) => {
  md.core.ruler.after('block', 'mermaid', (state) => {
    for (const token of state.tokens) {
      if (token.type === 'fence' && token.info.trim().toLowerCase() === 'mermaid') {
        token.type = 'mermaid'
      }
    }
    return true
  })
}
