import type { Node as PMNode } from 'prosemirror-model'
import { MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown'
import { schema } from './schema'
import { videoMarkdownItPlugin } from './video-markdown-it'
import { tooltipMarkdownItPlugin } from './tooltip-markdown-it'
import { fontSizeMarkdownItPlugin } from './font-size-markdown-it'
import { textColorMarkdownItPlugin } from './text-color-markdown-it'

const tokenizer = defaultMarkdownParser.tokenizer
  .use(videoMarkdownItPlugin)
  .use(tooltipMarkdownItPlugin)
  .use(fontSizeMarkdownItPlugin)
  .use(textColorMarkdownItPlugin)

const markdownParser = new MarkdownParser(schema, tokenizer, {
  ...defaultMarkdownParser.tokens,
  video: {
    node: 'video',
    getAttrs: (tok) => ({
      src: tok.attrGet('src'),
      title: tok.attrGet('title') || null,
    }),
  },
  s: { mark: 'strikethrough' },
  tooltip: {
    mark: 'tooltip',
    getAttrs: (tok) => ({
      content: tok.attrGet('content') || '',
    }),
  },
  font_size: {
    mark: 'fontSize',
    getAttrs: (tok) => ({
      size: tok.attrGet('size') || '',
    }),
  },
  text_color: {
    mark: 'textColor',
    getAttrs: (tok) => ({
      color: tok.attrGet('color') || '',
    }),
  },
})

const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    video(state, node) {
      state.write(
        '!video[' +
          state.esc(node.attrs.title || '') +
          '](' +
          node.attrs.src.replace(/[()]/g, '\\$&') +
          ')',
      )
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    strikethrough: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    tooltip: {
      open: '^[',
      close(_state, mark) {
        return '](' + String(mark.attrs.content).replace(/[()\\]/g, String.raw`\$&`) + ')'
      },
      mixable: true,
    },
    fontSize: {
      open: '%[',
      close(_state, mark) {
        return '](' + String(mark.attrs.size) + ')'
      },
      mixable: true,
    },
    textColor: {
      open: '@[',
      close(_state, mark) {
        return '](' + String(mark.attrs.color) + ')'
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
