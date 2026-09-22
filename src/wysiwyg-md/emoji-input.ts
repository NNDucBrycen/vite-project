import { Fragment, Slice } from 'prosemirror-model'
import type { Mark, Node as PMNode, Schema } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import { splitEmojiText } from './twemoji'

function emojiNodes(text: string, marks: readonly Mark[], schema: Schema): PMNode[] {
  return splitEmojiText(text).map((part) => part.emoji
    ? schema.nodes.emoji.create({ emoji: part.text }, null, marks)
    : schema.text(part.text, marks))
}

function convertFragment(fragment: Fragment, schema: Schema): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((node) => {
    if (node.isText && splitEmojiText(node.text!).some((part) => part.emoji)) {
      nodes.push(...emojiNodes(node.text!, node.marks, schema))
    } else if (node.content.size) {
      nodes.push(node.copy(convertFragment(node.content, schema)))
    } else {
      nodes.push(node)
    }
  })
  return Fragment.fromArray(nodes)
}

export function emojiInputPlugin(): Plugin {
  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        if (view.composing || !splitEmojiText(text).some((part) => part.emoji)) return false
        const marks = view.state.storedMarks ?? view.state.doc.resolve(from).marks()
        view.dispatch(view.state.tr.replaceWith(from, to, emojiNodes(text, marks, view.state.schema)).scrollIntoView())
        return true
      },
      transformPasted(slice, view) {
        return new Slice(convertFragment(slice.content, view.state.schema), slice.openStart, slice.openEnd)
      },
    },
  })
}
