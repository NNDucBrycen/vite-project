import type { MarkType, Schema } from 'prosemirror-model'
import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from 'prosemirror-inputrules'

// regexp must have the form /(^|\s)MARKERtextMARKER$/ — group 1 is the
// boundary character (kept as-is), group 2 is the wrapped text. Marker
// length is derived from what's left so it works for both * and **.
function markInputRule(regexp: RegExp, markType: MarkType): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const [full, boundary, text] = match
    const { tr } = state
    const markerLength = (full.length - boundary.length - text.length) / 2
    const markStart = start + boundary.length
    const textStart = markStart + markerLength
    const textEnd = textStart + text.length
    if (textEnd < end) tr.delete(textEnd, end)
    if (textStart > markStart) tr.delete(markStart, textStart)
    tr.addMark(markStart, markStart + text.length, markType.create())
    tr.removeStoredMark(markType)
    return tr
  })
}

export function buildInputRules(schema: Schema) {
  const rules: InputRule[] = [
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
      level: match[1].length,
    })),
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(
      /^(\d+)\.\s$/,
      schema.nodes.ordered_list,
      (match) => ({ order: +match[1] }),
      (match, node) => node.childCount + node.attrs.order === +match[1],
    ),
    markInputRule(/(^|\s)\*\*([^*]+)\*\*$/, schema.marks.strong),
    markInputRule(/(^|\s)__([^_]+)__$/, schema.marks.strong),
    markInputRule(/(^|\s)\*([^*]+)\*$/, schema.marks.em),
    markInputRule(/(^|\s)_([^_]+)_$/, schema.marks.em),
    new InputRule(/^(?:---|\*\*\*|___)$/, (state, _match, start, end) =>
      state.tr.replaceRangeWith(start, end, schema.nodes.horizontal_rule.create()),
    ),
  ]

  return inputRules({ rules })
}
