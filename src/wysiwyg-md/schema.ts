import { Schema } from 'prosemirror-model'
import { schema as baseSchema } from 'prosemirror-markdown'

const nodes = baseSchema.spec.nodes.addToEnd('video', {
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
  .addToEnd('tooltip', {
    attrs: {
      content: {},
    },
    parseDOM: [
      {
        tag: 'span[data-tooltip]',
        getAttrs(dom: HTMLElement) {
          return { content: dom.dataset.tooltip }
        },
      },
    ],
    toDOM(mark) {
      return [
        'span',
        { class: 'wysiwyg-md-tooltip', 'data-tooltip': mark.attrs.content },
        0,
      ]
    },
  })
  .addToEnd('fontSize', {
    attrs: {
      size: {},
    },
    parseDOM: [
      {
        style: 'font-size',
        getAttrs(value: string) {
          return { size: value }
        },
      },
    ],
    toDOM(mark) {
      return ['span', { style: `font-size: ${mark.attrs.size}` }, 0]
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

export const schema = new Schema({ nodes, marks })
