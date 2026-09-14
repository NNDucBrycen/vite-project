import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'
import { startImageUpload } from './image-upload'
import type { UploadImageFn } from './types'

export function createImageNodeView(
  uploadImage?: UploadImageFn,
  onUploadError?: (error: unknown, file: File) => void,
) {
  return function imageNodeView(
    initialNode: ProseMirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
  ): NodeView {
    let node = initialNode

    const dom = document.createElement('span')
    dom.className = 'wysiwyg-md-image-wrapper'

    const img = document.createElement('img')
    applyImgAttrs()
    dom.appendChild(img)

    const toolbar = document.createElement('span')
    toolbar.className = 'wysiwyg-md-image-toolbar'
    toolbar.contentEditable = 'false'
    dom.appendChild(toolbar)

    function applyImgAttrs() {
      img.src = node.attrs.src
      if (node.attrs.alt) img.alt = node.attrs.alt
      else img.removeAttribute('alt')
      if (node.attrs.title) img.title = node.attrs.title
      else img.removeAttribute('title')
    }

    function currentPos(): number | null {
      const pos = getPos()
      return typeof pos === 'number' ? pos : null
    }

    function toolbarButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'wysiwyg-md-image-toolbar-btn'
      btn.textContent = label
      btn.title = title
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      })
      return btn
    }

    const linkBtn = toolbarButton('🔗', 'Change image URL', () => {
      const url = window.prompt('Image URL', node.attrs.src ?? '')
      if (!url) return
      const pos = currentPos()
      if (pos == null) return
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url }))
      view.focus()
    })

    let fileInput: HTMLInputElement | null = null
    if (uploadImage) {
      fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'image/*'
      fileInput.style.display = 'none'
      fileInput.addEventListener('change', () => {
        const file = fileInput?.files?.[0]
        if (fileInput) fileInput.value = ''
        const pos = currentPos()
        if (!file || pos == null) return
        view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize))
        startImageUpload(view, file, uploadImage, onUploadError, pos)
      })
      dom.appendChild(fileInput)

      const uploadBtn = toolbarButton('⭱', 'Replace image (upload)', () => fileInput?.click())
      toolbar.appendChild(uploadBtn)
    }

    const deleteBtn = toolbarButton('✕', 'Remove image', () => {
      const pos = currentPos()
      if (pos == null) return
      view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize))
      view.focus()
    })

    toolbar.appendChild(linkBtn)
    toolbar.appendChild(deleteBtn)

    return {
      dom,
      selectNode() {
        dom.classList.add('ProseMirror-selectednode')
      },
      deselectNode() {
        dom.classList.remove('ProseMirror-selectednode')
      },
      update(updatedNode) {
        if (updatedNode.type !== node.type) return false
        node = updatedNode
        applyImgAttrs()
        return true
      },
      stopEvent(event) {
        return toolbar.contains(event.target as Node)
      },
      ignoreMutation() {
        return true
      },
    }
  }
}
