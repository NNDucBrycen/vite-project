import type { MarkType, NodeType } from 'prosemirror-model'
import { NodeSelection } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { schema } from './schema'
import { openTextDialog } from './text-dialog'

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

export async function toggleLink(view: EditorView): Promise<void> {
  const { state, dispatch } = view
  const { from, to, empty } = state.selection
  if (empty) return

  if (isLinkActive(state)) {
    dispatch(state.tr.removeMark(from, to, schema.marks.link))
    view.focus()
    return
  }

  const url = await openTextDialog({ title: 'Link URL', confirmLabel: 'Add link' })
  if (!url) return
  view.dispatch(view.state.tr.addMark(from, to, schema.marks.link.create({ href: url })))
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

export function insertHorizontalRule(view: EditorView): void {
  const { state, dispatch } = view
  const { schema, tr } = state
  dispatch(tr.replaceSelectionWith(schema.nodes.horizontal_rule.create()).scrollIntoView())
  view.focus()
}

/** Inserts a 3-column table with a header row and two editable body rows. */
export function insertTable(view: EditorView, borderless = false): void {
  const { table, table_row: row, table_header: header, table_cell: cell } = schema.nodes
  const makeCell = (type: typeof cell) => type.createAndFill()!
  const makeRow = (type: typeof cell) =>
    row.create(null, [makeCell(type), makeCell(type), makeCell(type)])

  const tableNode = table.create(
    { borderless },
    [makeRow(header), makeRow(cell), makeRow(cell)],
  )

  view.dispatch(view.state.tr.replaceSelectionWith(tableNode).scrollIntoView())
  view.focus()
}

/** Inserts a Unicode emoji at the current selection. */
export function insertEmoji(view: EditorView, emoji: string): void {
  if (!emoji) return

  const { state, dispatch } = view
  dispatch(state.tr.replaceSelectionWith(state.schema.text(emoji), true).scrollIntoView())
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

export function isHighlightActive(state: EditorState): boolean {
  return isMarkActive(state, schema.marks.highlight)
}

export function toggleHighlight(view: EditorView): void {
  const { state, dispatch } = view
  const { from, to, empty } = state.selection
  if (empty) return

  const mark = schema.marks.highlight
  const tr = state.doc.rangeHasMark(from, to, mark)
    ? state.tr.removeMark(from, to, mark)
    : state.tr.addMark(from, to, mark.create())
  dispatch(tr)
  view.focus()
}

/** Applies a background color to the current selection as a highlight. */
export function setHighlightColor(view: EditorView, color: string): void {
  const { state, dispatch } = view
  const { from, to, empty } = state.selection
  if (empty) return

  let tr = state.tr.removeMark(from, to, schema.marks.highlight)
  if (color) tr = tr.addMark(from, to, schema.marks.highlight.create({ color }))
  dispatch(tr)
  view.focus()
}
