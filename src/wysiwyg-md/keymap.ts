import type { Schema } from 'prosemirror-model'
import { baseKeymap, chainCommands, toggleMark } from 'prosemirror-commands'
import { undo, redo } from 'prosemirror-history'
import { undoInputRule } from 'prosemirror-inputrules'
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list'

export function buildKeymap(schema: Schema) {
  return {
    ...baseKeymap,
    'Mod-b': toggleMark(schema.marks.strong),
    'Mod-i': toggleMark(schema.marks.em),
    'Mod-Shift-x': toggleMark(schema.marks.strikethrough),
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-y': redo,
    Enter: chainCommands(splitListItem(schema.nodes.list_item), baseKeymap.Enter),
    Tab: sinkListItem(schema.nodes.list_item),
    'Shift-Tab': liftListItem(schema.nodes.list_item),
    Backspace: chainCommands(undoInputRule, baseKeymap.Backspace),
  }
}
