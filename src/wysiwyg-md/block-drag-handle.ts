import { NodeSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

export interface BlockDragHandle {
  reset(): void
  destroy(): void
}

interface BlockElement {
  pos: number
  element: HTMLElement
}

const dragType = 'application/x-wysiwyg-md-block'

export function createBlockDragHandle(view: EditorView, container: HTMLElement): BlockDragHandle {
  const handle = document.createElement('button')
  handle.type = 'button'
  handle.className = 'wysiwyg-md-block-drag-handle'
  handle.title = 'Drag to move block'
  handle.setAttribute('aria-label', 'Drag to move block')
  handle.draggable = true
  handle.textContent = '⠿'
  handle.hidden = true

  const indicator = document.createElement('div')
  indicator.className = 'wysiwyg-md-block-drop-indicator'
  indicator.hidden = true
  container.append(handle, indicator)

  let hoveredPos: number | null = null
  let draggedPos: number | null = null
  let dropIndex: number | null = null

  function blocks(): BlockElement[] {
    const result: BlockElement[] = []
    view.state.doc.forEach((_node, pos) => {
      const element = view.nodeDOM(pos)
      if (element instanceof HTMLElement) result.push({ pos, element })
    })
    return result
  }

  function hide() {
    hoveredPos = null
    handle.hidden = true
  }

  function reset() {
    hide()
    indicator.hidden = true
    dropIndex = null
    draggedPos = null
  }

  function onPointerMove(event: PointerEvent) {
    if (draggedPos !== null || !view.editable || event.target === handle) return
    const target = event.target
    if (!(target instanceof Node)) return
    const block = blocks().find(({ element }) => element.contains(target))
    // Keep the handle visible while the pointer crosses the gutter between it and the block.
    if (!block) return

    hoveredPos = block.pos
    const blockRect = block.element.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const topOffset = block.element.matches('h1') ? 14 : 4
    handle.style.left = `${blockRect.left - containerRect.left - 39}px`
    handle.style.top = `${blockRect.top - containerRect.top + topOffset}px`
    handle.hidden = false
  }

  function onDragStart(event: DragEvent) {
    if (!view.editable || hoveredPos === null || !event.dataTransfer) {
      event.preventDefault()
      return
    }
    draggedPos = hoveredPos
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(dragType, String(draggedPos))
    event.dataTransfer.setData('text/plain', view.state.doc.nodeAt(draggedPos)?.textContent ?? '')
  }

  function onDragOver(event: DragEvent) {
    if (draggedPos === null || !view.editable || !event.dataTransfer?.types.includes(dragType)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'

    const items = blocks()
    const sourceIndex = items.findIndex(({ pos }) => pos === draggedPos)
    if (sourceIndex < 0) { indicator.hidden = true; return }
    const index = items.findIndex(({ element }) => event.clientY < element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2)
    dropIndex = index < 0 ? items.length : index
    if (dropIndex === sourceIndex || dropIndex === sourceIndex + 1) {
      indicator.hidden = true
      return
    }

    const containerRect = container.getBoundingClientRect()
    const editorRect = view.dom.getBoundingClientRect()
    const y = dropIndex === items.length
      ? items[items.length - 1]!.element.getBoundingClientRect().bottom
      : items[dropIndex]!.element.getBoundingClientRect().top
    indicator.style.top = `${y - containerRect.top}px`
    indicator.style.left = `${editorRect.left - containerRect.left}px`
    indicator.style.width = `${editorRect.width}px`
    indicator.hidden = false
  }

  function onDrop(event: DragEvent) {
    if (draggedPos === null || !event.dataTransfer?.types.includes(dragType)) return
    event.preventDefault()
    event.stopPropagation()
    const items = blocks()
    const sourceIndex = items.findIndex(({ pos }) => pos === draggedPos)
    const destination = dropIndex
    if (view.editable && sourceIndex >= 0 && destination !== null && destination !== sourceIndex && destination !== sourceIndex + 1) {
      const source = items[sourceIndex]!
      const node = view.state.doc.nodeAt(source.pos)
      if (node) {
        const boundary = destination === items.length ? view.state.doc.content.size : items[destination]!.pos
        const insertPos = boundary > source.pos ? boundary - node.nodeSize : boundary
        const tr = view.state.tr.delete(source.pos, source.pos + node.nodeSize).insert(insertPos, node)
        tr.setSelection(NodeSelection.create(tr.doc, insertPos))
        view.dispatch(tr.scrollIntoView())
        view.focus()
      }
    }
    reset()
  }

  container.addEventListener('pointermove', onPointerMove)
  container.addEventListener('pointerleave', hide)
  container.addEventListener('dragover', onDragOver, true)
  container.addEventListener('drop', onDrop, true)
  handle.addEventListener('dragstart', onDragStart)
  handle.addEventListener('dragend', reset)

  return {
    reset,
    destroy() {
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerleave', hide)
      container.removeEventListener('dragover', onDragOver, true)
      container.removeEventListener('drop', onDrop, true)
      handle.removeEventListener('dragstart', onDragStart)
      handle.removeEventListener('dragend', reset)
      handle.remove()
      indicator.remove()
    },
  }
}
