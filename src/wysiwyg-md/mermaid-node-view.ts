import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'
import { nodeButton, positionMenu } from './node-ui'
import { openTextDialog } from './text-dialog'

let nextDiagramId = 0
let mermaidPromise: Promise<(typeof import('mermaid'))['default']> | null = null

function getMermaid() {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      flowchart: { padding: 20, rankSpacing: 50 },
      themeVariables: {
        primaryColor: '#f3f7ff',
        primaryBorderColor: '#4784ff',
        primaryTextColor: '#1e2b40',
        lineColor: '#263448',
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
      },
    })
    return mermaid
  })
  return mermaidPromise
}

async function renderDiagram(source: string) {
  const mermaid = await getMermaid()
  return mermaid.render(`wysiwyg-md-mermaid-${nextDiagramId += 1}`, source)
}

export function createMermaidNodeView(
  initialNode: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined,
): NodeView {
  let node = initialNode
  let renderVersion = 0
  let destroyed = false

  const dom = document.createElement('figure')
  dom.className = 'wysiwyg-md-mermaid'
  dom.contentEditable = 'false'

  const diagram = document.createElement('div')
  diagram.className = 'wysiwyg-md-mermaid-diagram'
  diagram.setAttribute('role', 'img')
  diagram.setAttribute('aria-label', 'Mermaid diagram')

  const status = document.createElement('figcaption')
  status.className = 'wysiwyg-md-mermaid-status'
  const toolbar = document.createElement('div')
  toolbar.className = 'wysiwyg-md-mermaid-toolbar'
  const source = document.createElement('pre')
  source.className = 'wysiwyg-md-mermaid-source'
  source.hidden = true
  const edit = nodeButton('Edit diagram', 'edit', async () => {
    if (!view.editable) return
    const code = await openTextDialog({
      title: 'Mermaid diagram source',
      value: String(node.attrs.code ?? ''),
      multiline: true,
      confirmLabel: 'Save diagram',
    })
    const pos = getPos()
    if (code == null || destroyed || typeof pos !== 'number') return
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, code }))
    view.focus()
  })
  const viewSource = nodeButton('View source', 'code', () => {
    source.hidden = !source.hidden
    source.textContent = String(node.attrs.code ?? '')
    diagram.hidden = !source.hidden
    viewSource.setAttribute('aria-pressed', String(!source.hidden))
  })
  const menu = document.createElement('div')
  menu.className = 'wysiwyg-md-media-menu'
  menu.hidden = true
  menu.setAttribute('role', 'menu')
  const more = nodeButton('Diagram options', 'more', () => {
    menu.hidden = !menu.hidden
    more.setAttribute('aria-expanded', String(!menu.hidden))
    if (!menu.hidden) positionMenu(menu)
  })
  more.setAttribute('aria-haspopup', 'menu')
  more.setAttribute('aria-expanded', 'false')
  const remove = nodeButton('Delete diagram', 'delete', () => {
    const pos = getPos()
    if (!view.editable || typeof pos !== 'number') return
    view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize))
    view.focus()
  })
  remove.classList.add('is-danger')
  remove.setAttribute('role', 'menuitem')
  menu.append(remove)
  toolbar.append(edit, viewSource, more, menu)
  function closeMenu(event: Event) {
    if (event instanceof KeyboardEvent && event.key !== 'Escape') return
    if (event.type === 'pointerdown' && toolbar.contains(event.target as Node)) return
    menu.hidden = true
    more.setAttribute('aria-expanded', 'false')
  }
  document.addEventListener('pointerdown', closeMenu)
  document.addEventListener('keydown', closeMenu)
  dom.append(toolbar, diagram, source, status)

  async function render() {
    const version = renderVersion += 1
    const source = String(node.attrs.code ?? '').trim()
    diagram.replaceChildren()

    if (!source) {
      status.textContent = 'Empty Mermaid diagram'
      return
    }

    status.textContent = 'Rendering diagram…'
    try {
      const { svg, bindFunctions } = await renderDiagram(source)
      if (version !== renderVersion) return
      diagram.innerHTML = svg
      bindFunctions?.(diagram)
      status.textContent = ''
    } catch {
      if (version !== renderVersion) return
      status.textContent = 'Unable to render this Mermaid diagram.'
      dom.classList.add('is-error')
    }
  }

  void render()

  return {
    dom,
    update(updatedNode) {
      if (updatedNode.type !== node.type) return false
      const changed = updatedNode.attrs.code !== node.attrs.code
      node = updatedNode
      dom.classList.remove('is-error')
      source.textContent = String(node.attrs.code ?? '')
      if (changed) void render()
      return true
    },
    selectNode() {
      dom.classList.add('ProseMirror-selectednode')
    },
    deselectNode() {
      dom.classList.remove('ProseMirror-selectednode')
    },
    ignoreMutation() {
      return true
    },
    stopEvent() {
      return true
    },
    destroy() {
      destroyed = true
      renderVersion++
      document.removeEventListener('pointerdown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    },
  }
}
