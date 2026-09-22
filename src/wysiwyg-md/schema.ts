import { Schema } from 'prosemirror-model'
import { schema as baseSchema } from 'prosemirror-markdown'
import { tableNodes } from 'prosemirror-tables'
import { createSvgIcon, getSvgIcon } from './svg-icons'
import { createEmojiGlyph, splitEmojiText } from './twemoji'
import { getCaption } from './captions'

const tableNodeSpecs = tableNodes({
  tableGroup: 'block',
  // Markdown-it exposes table cell contents as inline tokens. Keeping cells
  // inline lets the parser preserve that content without adding a paragraph
  // wrapper that Markdown tables cannot represent.
  cellContent: 'inline*',
  cellAttributes: {},
})

tableNodeSpecs.table = {
  ...tableNodeSpecs.table,
  attrs: {
    borderless: { default: false },
  },
  parseDOM: [
    {
      tag: 'table',
      getAttrs(dom: HTMLElement) {
        return { borderless: dom.classList.contains('wysiwyg-md-table-borderless') }
      },
    },
  ],
  toDOM(node) {
    return [
      'table',
      { class: node.attrs.borderless ? 'wysiwyg-md-table-borderless' : null },
      ['tbody', 0],
    ]
  },
}

const nodes = baseSchema.spec.nodes
  .update('horizontal_rule', {
    ...baseSchema.spec.nodes.get('horizontal_rule')!,
    selectable: true,
    toDOM() {
      return ['div', { class: 'wysiwyg-md-horizontal-rule' }, ['hr']]
    },
  })
  .update('image', {
    ...baseSchema.spec.nodes.get('image')!,
    attrs: {
      src: {}, alt: { default: null }, title: { default: null },
      size: { default: 'original' }, align: { default: 'left' },
    },
    parseDOM: [{
      tag: 'img[src]',
      getAttrs(dom: HTMLElement) {
        return {
          src: dom.getAttribute('src'), alt: dom.getAttribute('alt'), title: dom.getAttribute('title'),
          size: dom.dataset.size || 'original', align: dom.dataset.align || 'left',
        }
      },
    }],
    toDOM(node) {
      const { src, alt, title, size, align } = node.attrs
      return ['img', { src, alt, title, 'data-size': size, 'data-align': align }]
    },
  })
  .append(tableNodeSpecs)
  .addToEnd('emoji', {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { emoji: {} },
    parseDOM: [{
      tag: 'span.wysiwyg-md-emoji-glyph[data-emoji]',
      getAttrs(dom: HTMLElement) {
        const emoji = dom.dataset.emoji ?? ''
        const parts = splitEmojiText(emoji)
        return parts.length === 1 && parts[0].emoji ? { emoji } : false
      },
    }],
    toDOM(node) {
      return createEmojiGlyph(node.attrs.emoji, true)
    },
  })
  .addToEnd('svg_icon', {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { name: {} },
    parseDOM: [{
      tag: 'svg.icon',
      getAttrs(dom: HTMLElement) {
        const href = dom.querySelector('use')?.getAttribute('href') ?? ''
        const match = /^\/sprite\.svg(?:\?v=[a-f0-9]+)?#([A-Za-z][A-Za-z0-9_-]*)$/.exec(href)
        return match && getSvgIcon(match[1]) ? { name: match[1] } : false
      },
    }],
    toDOM(node) {
      return createSvgIcon(node.attrs.name)
    },
  })
  .addToEnd('caption', {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { key: {} },
    parseDOM: [{
      tag: 'span.wysiwyg-md-caption[data-caption-key]',
      getAttrs(dom: HTMLElement) {
        const key = dom.dataset.captionKey ?? ''
        return getCaption(key) ? { key } : false
      },
    }],
    toDOM(node) {
      const key = String(node.attrs.key)
      return ['span', { class: 'wysiwyg-md-caption', 'data-caption-key': key, title: key }, getCaption(key)?.LABEL ?? key]
    },
  })
  .addToEnd('mermaid', {
    group: 'block',
    atom: true,
    selectable: true,
    attrs: {
      code: { default: '' },
    },
    parseDOM: [
      {
        tag: 'pre[data-wysiwyg-md-mermaid]',
        getAttrs(dom: HTMLElement) {
          return { code: dom.textContent ?? '' }
        },
      },
    ],
    toDOM(node) {
      return ['pre', { 'data-wysiwyg-md-mermaid': 'true' }, String(node.attrs.code)]
    },
  })
  .addToEnd('video', {
  inline: true,
  attrs: {
    src: {},
    title: { default: null },
  },
  group: 'inline',
  draggable: true,
  parseDOM: [
    {
      tag: 'video[src]',
      getAttrs(dom: HTMLElement) {
        return {
          src: dom.getAttribute('src'),
          title: dom.getAttribute('title'),
        }
      },
    },
  ],
  toDOM(node) {
    return ['video', { ...node.attrs, controls: 'controls', playsinline: 'true' }]
  },
})

const marks = baseSchema.spec.marks
  .addToEnd('strikethrough', {
    parseDOM: [
      { tag: 'del' },
      { tag: 's' },
      { tag: 'strike' },
      { style: 'text-decoration=line-through' },
    ],
    toDOM() {
      return ['s', 0]
    },
  })
  .addToEnd('textColor', {
    attrs: {
      color: {},
    },
    parseDOM: [
      {
        style: 'color',
        getAttrs(value: string) {
          return { color: value }
        },
      },
    ],
    toDOM(mark) {
      return ['span', { style: `color: ${mark.attrs.color}` }, 0]
    },
  })
  .addToEnd('highlight', {
    attrs: {
      color: { default: null },
    },
    parseDOM: [
      {
        tag: 'span.wysiwyg-md-highlight',
        getAttrs(dom: HTMLElement) {
          return { color: dom.style.backgroundColor || null }
        },
      },
    ],
    toDOM(mark) {
      return [
        'span',
        {
          class: 'wysiwyg-md-highlight',
          style: mark.attrs.color ? `background-color: ${mark.attrs.color}` : null,
        },
        0,
      ]
    },
  })

export const schema = new Schema({ nodes, marks })
