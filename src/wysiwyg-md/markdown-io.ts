import type { Node as PMNode } from 'prosemirror-model'
import { MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown'
import { schema } from './schema'
import { videoMarkdownItPlugin } from './video-markdown-it'
import { textColorMarkdownItPlugin } from './text-color-markdown-it'
import { highlightMarkdownItPlugin } from './highlight-markdown-it'
import { mermaidMarkdownItPlugin } from './mermaid-markdown-it'
import { tableMarkdownItPlugin } from './table-markdown-it'
import { imageMarkdownItPlugin } from './image-markdown-it'

const tokenizer = defaultMarkdownParser.tokenizer
  .enable('table')
  .use(tableMarkdownItPlugin)
  .use(videoMarkdownItPlugin)
  .use(textColorMarkdownItPlugin)
  .use(highlightMarkdownItPlugin)
  .use(mermaidMarkdownItPlugin)
  .use(imageMarkdownItPlugin)

const markdownParser = new MarkdownParser(schema, tokenizer, {
  ...defaultMarkdownParser.tokens,
  image: {
    node: 'image',
    getAttrs: (tok) => ({
      src: tok.attrGet('src'), alt: tok.children?.[0]?.content || tok.content || null,
      title: tok.attrGet('title') || null,
      size: tok.attrGet('data-size') || 'original', align: tok.attrGet('data-align') || 'left',
    }),
  },
  table: {
    block: 'table',
    getAttrs: (tok) => ({ borderless: tok.attrGet('data-wysiwyg-md-borderless') === 'true' }),
  },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: 'table_row' },
  th: { block: 'table_header' },
  td: { block: 'table_cell' },
  video: {
    node: 'video',
    getAttrs: (tok) => ({
      src: tok.attrGet('src'),
      title: tok.attrGet('title') || null,
    }),
  },
  mermaid: {
    node: 'mermaid',
    getAttrs: (tok) => ({ code: tok.content.replace(/\n$/, '') }),
  },
  s: { mark: 'strikethrough' },
  text_color: {
    mark: 'textColor',
    getAttrs: (tok) => ({
      color: tok.attrGet('color') || '',
    }),
  },
  highlight: {
    mark: 'highlight',
    getAttrs: (tok) => ({ color: tok.attrGet('color') || null }),
  },
})

const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    image(state, node, parent, index) {
      defaultMarkdownSerializer.nodes.image!(state, node, parent, index)
      if (node.attrs.size !== 'original' || node.attrs.align !== 'left') {
        state.write(`{size=${node.attrs.size} align=${node.attrs.align}}`)
      }
    },
    video(state, node) {
      state.write(
        '!video[' +
          state.esc(node.attrs.title || '') +
          '](' +
          node.attrs.src.replace(/[()]/g, '\\$&') +
          ')',
      )
    },
    mermaid(state, node) {
      const code = String(node.attrs.code ?? '')
      const backticks = code.match(/`{3,}/gm)
      const fence = backticks ? `${backticks.sort().at(-1)}\`` : '```'
      state.write(`${fence}mermaid\n`)
      state.text(code, false)
      state.write(`\n${fence}`)
      state.closeBlock(node)
    },
    table(state, node) {
      if (node.attrs.borderless) {
        state.write('<!-- wysiwyg-md:borderless-table -->')
        state.ensureNewLine()
      }

      node.forEach((row, rowIndex) => {
        state.write('|')
        row.forEach((cell) => {
          state.write(' ')
          state.renderInline(cell)
          state.write(' |')
        })
        state.ensureNewLine()

        if (rowIndex === 0) {
          state.write('|')
          row.forEach(() => state.write(' --- |'))
          state.ensureNewLine()
        }
      })
      state.closeBlock(node)
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    strikethrough: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    textColor: {
      open: '@[',
      close(_state, mark) {
        return '](' + String(mark.attrs.color) + ')'
      },
      mixable: true,
    },
    highlight: {
      open(_state, mark) {
        return mark.attrs.color ? '==[' : '=='
      },
      close(_state, mark) {
        return mark.attrs.color ? `](${mark.attrs.color})==` : '=='
      },
      mixable: true,
    },
  },
)

function emptyDoc(): PMNode {
  return schema.node('doc', null, [schema.node('paragraph')])
}

export function parseMarkdown(markdown: string): PMNode {
  if (!markdown.trim()) return emptyDoc()
  return markdownParser.parse(markdown) ?? emptyDoc()
}

export function serializeMarkdown(doc: PMNode): string {
  return markdownSerializer.serialize(doc)
}
