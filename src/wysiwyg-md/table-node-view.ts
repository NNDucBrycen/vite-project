import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { closeHistory } from 'prosemirror-history'
import { TextSelection } from 'prosemirror-state'
import type { Command } from 'prosemirror-state'
import {
  addColumnAfter, addColumnBefore, addRowAfter, addRowBefore,
  deleteColumn, deleteRow, deleteTable, TableMap,
} from 'prosemirror-tables'
import type { EditorView, NodeView } from 'prosemirror-view'
import { nodeIcon, positionMenu } from './node-ui'
import type { NodeIcon } from './node-ui'

export function createTableNodeView(
  initialNode: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined,
): NodeView {
  let node = initialNode
  let activeCell: HTMLTableCellElement | null = null

  const dom = document.createElement('div')
  dom.className = 'wysiwyg-md-table-wrapper'
  const table = document.createElement('table')
  const contentDOM = document.createElement('tbody')
  table.append(contentDOM)
  dom.append(table)

  const controls = document.createElement('div')
  controls.className = 'wysiwyg-md-table-actions'
  controls.contentEditable = 'false'
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'wysiwyg-md-table-actions-toggle'
  toggle.title = 'Table actions'
  toggle.setAttribute('aria-label', 'Table actions')
  toggle.setAttribute('aria-expanded', 'false')
  toggle.setAttribute('aria-haspopup', 'menu')
  toggle.append(nodeIcon('more'))
  const menu = document.createElement('div')
  menu.className = 'wysiwyg-md-table-actions-menu'
  menu.setAttribute('role', 'menu')
  menu.hidden = true
  controls.append(toggle, menu)
  dom.append(controls)

  function closeMenu() {
    menu.hidden = true
    toggle.setAttribute('aria-expanded', 'false')
    dom.classList.remove('is-menu-open')
  }
  toggle.addEventListener('mousedown', (event) => event.preventDefault())
  toggle.addEventListener('click', () => {
    if (!view.editable) return
    menu.hidden = !menu.hidden
    toggle.setAttribute('aria-expanded', String(!menu.hidden))
    dom.classList.toggle('is-menu-open', !menu.hidden)
    if (!menu.hidden) positionMenu(menu)
  })

  function run(command: Command) {
    if (!view.editable || !view.dom.contains(dom)) return
    const tablePos = getPos()
    const { $head } = view.state.selection
    const selectionInTable = tablePos !== undefined && Array.from(
      { length: $head.depth }, (_, index) => index + 1,
    ).some((depth) => $head.before(depth) === tablePos)
    if (selectionInTable) {
      command(view.state, (tr) => view.dispatch(closeHistory(tr)), view)
      closeMenu()
      view.focus()
      return
    }
    const cell = activeCell?.isConnected
      ? activeCell
      : contentDOM.querySelector<HTMLTableCellElement>('th, td')
    if (!cell) return
    const pos = view.posAtDOM(cell, 0)
    const state = view.state.apply(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
    command(state, (tr) => view.dispatch(closeHistory(tr)), view)
    closeMenu()
    view.focus()
  }

  function item(label: string, command: Command, danger = false, icon: NodeIcon = 'delete') {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'wysiwyg-md-table-actions-item'
    if (danger) button.classList.add('is-danger')
    button.append(nodeIcon(icon), document.createTextNode(label))
    button.setAttribute('role', 'menuitem')
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', () => run(command))
    menu.append(button)
    return button
  }
  item('Insert row above', addRowBefore, false, 'row')
  item('Insert row below', addRowAfter, false, 'row')
  item('Insert column left', addColumnBefore, false, 'column')
  item('Insert column right', addColumnAfter, false, 'column')
  const divider = document.createElement('span')
  divider.className = 'wysiwyg-md-table-actions-divider'
  menu.append(divider)
  const deleteRowButton = item('Delete row', deleteRow)
  const deleteColumnButton = item('Delete column', deleteColumn)
  menu.append(divider.cloneNode())
  item('Delete table', deleteTable, true)

  dom.addEventListener('pointerover', (event) => {
    if (!(event.target instanceof Element)) return
    const cell = event.target.closest<HTMLTableCellElement>('th, td')
    if (cell && cell.closest('table') === table) activeCell = cell
  })
  function onPointerDown(event: PointerEvent) {
    if (!controls.contains(event.target as Node)) closeMenu()
  }
  document.addEventListener('pointerdown', onPointerDown)
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !menu.hidden) { closeMenu(); toggle.focus() }
  }
  document.addEventListener('keydown', onKeyDown)
  dom.addEventListener('focusin', (event) => {
    if (!(event.target instanceof Element)) return
    const cell = event.target.closest<HTMLTableCellElement>('th, td')
    if (cell && cell.closest('table') === table) activeCell = cell
  })
  function applyAttrs() {
    table.classList.toggle('wysiwyg-md-table-borderless', node.attrs.borderless)
    deleteRowButton.disabled = node.childCount <= 1
    deleteColumnButton.disabled = TableMap.get(node).width <= 1
  }
  applyAttrs()

  return {
    dom,
    contentDOM,
    update(updatedNode) {
      if (updatedNode.type !== node.type) return false
      node = updatedNode
      applyAttrs()
      return true
    },
    stopEvent(event) {
      return controls.contains(event.target as Node)
    },
    ignoreMutation(mutation) {
      if (mutation.type === 'selection') return false
      return !contentDOM.contains(mutation.target)
    },
    destroy() {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    },
  }
}
