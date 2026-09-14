import type { MarkType, NodeType } from 'prosemirror-model'
import { NodeSelection } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { schema } from './schema'

export function isMarkActive(state: EditorState, markType: MarkType): boolean {
  const { from, $from, to, empty } = state.selection
  if (empty) return !!markType.isInSet(state.storedMarks ?? $from.marks())
  return state.doc.rangeHasMark(from, to, markType)
}

export function isBlockActive(
  state: EditorState,
  nodeType: NodeType,
  attrs: Record<string, unknown> = {},
): boolean {
  const { $from, to } = state.selection
  if (state.selection instanceof NodeSelection) return state.selection.node.hasMarkup(nodeType, attrs)
  return to <= $from.end() && $from.parent.hasMarkup(nodeType, attrs)
}

export function isLinkActive(state: EditorState): boolean {
  return isMarkActive(state, schema.marks.link)
}

export function toggleLink(view: EditorView): void {
  const { state, dispatch } = view
  const { from, to, empty } = state.selection
  if (empty) return

  if (isLinkActive(state)) {
    dispatch(state.tr.removeMark(from, to, schema.marks.link))
    view.focus()
    return
  }

  const url = window.prompt('Link URL')
  if (!url) return
  dispatch(state.tr.addMark(from, to, schema.marks.link.create({ href: url })))
  view.focus()
}

export function isTooltipActive(state: EditorState): boolean {
  return isMarkActive(state, schema.marks.tooltip)
}

export function toggleTooltip(view: EditorView): void {
  const { state, dispatch } = view
  const { from, to, empty } = state.selection
  if (empty) return

  if (isTooltipActive(state)) {
    dispatch(state.tr.removeMark(from, to, schema.marks.tooltip))
    view.focus()
    return
  }

  const content = window.prompt('Tooltip content')
  if (!content) return
  dispatch(state.tr.addMark(from, to, schema.marks.tooltip.create({ content })))
  view.focus()
}

function getActiveMarkAttr<T>(
  state: EditorState,
  markType: MarkType,
  attr: string,
): T | null {
  const { from, $from, to, empty } = state.selection
  if (empty) {
    const mark = markType.isInSet(state.storedMarks ?? $from.marks())
    return mark ? (mark.attrs[attr] as T) : null
  }
  let value: T | null = null
  state.doc.nodesBetween(from, to, (node) => {
    const mark = markType.isInSet(node.marks)
    if (mark) value = mark.attrs[attr] as T
  })
  return value
}

export function isFontSizeActive(state: EditorState): boolean {
  return isMarkActive(state, schema.marks.fontSize)
}

export function getActiveFontSize(state: EditorState): string | null {
  return getActiveMarkAttr<string>(state, schema.marks.fontSize, 'size')
}

export function setFontSize(view: EditorView, size: string): void {
  const { state, dispatch } = view
  const { from, to, empty } = state.selection
  if (empty) return

  let tr = state.tr.removeMark(from, to, schema.marks.fontSize)
  if (size) tr = tr.addMark(from, to, schema.marks.fontSize.create({ size }))
  dispatch(tr)
  view.focus()
}

export function insertHorizontalRule(view: EditorView): void {
  const { state, dispatch } = view
  const { schema, tr } = state
  dispatch(tr.replaceSelectionWith(schema.nodes.horizontal_rule.create()).scrollIntoView())
  view.focus()
}

export function isTextColorActive(state: EditorState): boolean {
  return isMarkActive(state, schema.marks.textColor)
}

export function getActiveTextColor(state: EditorState): string | null {
  return getActiveMarkAttr<string>(state, schema.marks.textColor, 'color')
}

export function setTextColor(view: EditorView, color: string): void {
  const { state, dispatch } = view
  const { from, to, empty } = state.selection
  if (empty) return

  let tr = state.tr.removeMark(from, to, schema.marks.textColor)
  if (color) tr = tr.addMark(from, to, schema.marks.textColor.create({ color }))
  dispatch(tr)
  view.focus()
}
