import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'
import { startVideoUpload } from './video-upload'
import type { UploadVideoFn } from './types'

export function createVideoNodeView(
  uploadVideo?: UploadVideoFn,
  onUploadError?: (error: unknown, file: File) => void,
) {
  return function videoNodeView(
    initialNode: ProseMirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
  ): NodeView {
    let node = initialNode

    const dom = document.createElement('span')
    dom.className = 'wysiwyg-md-video-wrapper'

    const video = document.createElement('video')
    video.controls = true
    applyVideoAttrs()
    dom.appendChild(video)

    const toolbar = document.createElement('span')
    toolbar.className = 'wysiwyg-md-video-toolbar'
    toolbar.contentEditable = 'false'
    dom.appendChild(toolbar)

    function applyVideoAttrs() {
      video.src = node.attrs.src
      if (node.attrs.title) video.title = node.attrs.title
      else video.removeAttribute('title')
    }

    function currentPos(): number | null {
      const pos = getPos()
      return typeof pos === 'number' ? pos : null
    }

    function toolbarButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'wysiwyg-md-video-toolbar-btn'
      btn.textContent = label
      btn.title = title
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      })
      return btn
    }

    const linkBtn = toolbarButton('🔗', 'Change video URL', () => {
      const url = window.prompt('Video URL', node.attrs.src ?? '')
      if (!url) return
      const pos = currentPos()
      if (pos == null) return
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url }))
      view.focus()
    })

    let fileInput: HTMLInputElement | null = null
    if (uploadVideo) {
      fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'video/*'
      fileInput.style.display = 'none'
      fileInput.addEventListener('change', () => {
        const file = fileInput?.files?.[0]
        if (fileInput) fileInput.value = ''
        const pos = currentPos()
        if (!file || pos == null) return
        view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize))
        startVideoUpload(view, file, uploadVideo, onUploadError, pos)
      })
      dom.appendChild(fileInput)

      const uploadBtn = toolbarButton('⭱', 'Replace video (upload)', () => fileInput?.click())
      toolbar.appendChild(uploadBtn)
    }

    const deleteBtn = toolbarButton('✕', 'Remove video', () => {
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
        applyVideoAttrs()
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
