import type { PluginSimple } from 'markdown-it'
import { splitEmojiText } from './twemoji'

export const emojiMarkdownItPlugin: PluginSimple = (md) => {
  md.core.ruler.after('text_join', 'twemoji', (state) => {
    for (const block of state.tokens) {
      if (!block.children) continue
      block.children = block.children.flatMap((token) => {
        if (token.type !== 'text') return [token]
        const parts = splitEmojiText(token.content)
        if (!parts.some((part) => part.emoji)) return [token]
        return parts.map((part) => {
          const next = new state.Token(part.emoji ? 'emoji' : 'text', '', 0)
          next.content = part.text
          next.level = token.level
          return next
        })
      })
    }
  })
}
