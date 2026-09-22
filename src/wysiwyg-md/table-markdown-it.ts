import type { PluginSimple } from 'markdown-it'

const BORDERLESS_TABLE_MARKER = '<!-- wysiwyg-md:borderless-table -->'

// Markdown has no standard way to store a table's presentation. A comment
// immediately before a table keeps the borderless choice in the Markdown
// while leaving the table itself portable GitHub-flavoured Markdown.
export const tableMarkdownItPlugin: PluginSimple = (md) => {
  md.core.ruler.after('block', 'wysiwyg_md_borderless_table', (state) => {
    for (let index = 0; index <= state.tokens.length - 4; index++) {
      const open = state.tokens[index]
      const marker = state.tokens[index + 1]
      const close = state.tokens[index + 2]
      const table = state.tokens[index + 3]

      if (
        open.type === 'paragraph_open' &&
        marker.type === 'inline' &&
        marker.content.trim() === BORDERLESS_TABLE_MARKER &&
        close.type === 'paragraph_close' &&
        table.type === 'table_open'
      ) {
        table.attrSet('data-wysiwyg-md-borderless', 'true')
        state.tokens.splice(index, 3)
      }
    }
  })
}
