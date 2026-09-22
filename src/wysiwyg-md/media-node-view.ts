import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'
import { nodeButton, positionMenu } from './node-ui'
import { openTextDialog } from './text-dialog'
import type { UploadImageFn } from './types'

export function createMediaNodeView(kind: 'image' | 'video', upload?: UploadImageFn, onError?: (error: unknown, file: File) => void) {
  return (initialNode: ProseMirrorNode, view: EditorView, getPos: () => number | undefined): NodeView => {
    let node = initialNode
    let destroyed = false
    let uploadVersion = 0
    const dom = document.createElement('span')
    dom.className = `wysiwyg-md-${kind}-wrapper`
    const frame = document.createElement('span')
    frame.className = 'wysiwyg-md-media-frame'
    const media = document.createElement(kind === 'image' ? 'img' : 'video')
    if (media instanceof HTMLVideoElement) {
      media.controls = true
      media.playsInline = true
      media.preload = 'metadata'
    }
    const play = document.createElement('button')
    play.type = 'button'
    play.className = 'wysiwyg-md-media-play'
    play.title = 'Play video'
    play.setAttribute('aria-label', 'Play video')
    play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>'
    play.hidden = kind !== 'video'
    if (media instanceof HTMLVideoElement) {
      play.addEventListener('mousedown', (event) => event.preventDefault())
      play.addEventListener('click', () => { void media.play() })
      const syncPlay = () => { play.hidden = !media.paused }
      media.addEventListener('play', syncPlay)
      media.addEventListener('pause', syncPlay)
      media.addEventListener('ended', syncPlay)
    }
    const caption = document.createElement('span')
    caption.className = 'wysiwyg-md-media-caption'
    const toolbar = document.createElement('span')
    toolbar.className = `wysiwyg-md-${kind}-toolbar wysiwyg-md-node-toolbar`
    toolbar.contentEditable = 'false'
    toolbar.setAttribute('aria-label', `${kind} actions`)
    const menu = document.createElement('span')
    menu.className = 'wysiwyg-md-media-menu'
    menu.setAttribute('role', 'menu')
    menu.hidden = true
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = kind + '/*'
    input.hidden = true
    input.addEventListener('change', async () => {
      const file = input.files?.[0]
      input.value = ''
      const pos = getPos()
      if (!file || !upload || typeof pos !== 'number' || !view.editable) return
      // Upload first: a failed replacement must not delete the existing media.
      const version = ++uploadVersion
      dom.classList.add('is-uploading')
      try {
        const src = await upload(file)
        if (!destroyed && version === uploadVersion) setAttrs({ src })
      } catch (error) {
        if (!destroyed) onError?.(error, file)
      } finally {
        if (!destroyed && version === uploadVersion) dom.classList.remove('is-uploading')
      }
    })
    function setAttrs(attrs: Record<string, unknown>) {
      const pos = getPos()
      if (typeof pos !== 'number' || !view.editable) return
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }))
    }
    async function changeUrl() {
      const src = await openTextDialog({
        title: `${kind === 'image' ? 'Image' : 'Video'} URL`,
        value: String(node.attrs.src ?? ''),
        confirmLabel: 'Save URL',
      })
      if (!destroyed && src?.trim()) setAttrs({ src: src.trim() })
    }
    const replace = nodeButton('Replace', 'replace', () => {
      if (!view.editable) return
      if (upload) input.click()
      else changeUrl()
    })
    const details = nodeButton(kind === 'image' ? 'Alt text' : 'Caption', kind === 'image' ? 'image' : 'caption', async () => {
      if (!view.editable) return
      const attr = kind === 'image' ? 'alt' : 'title'
      const value = await openTextDialog({
        title: kind === 'image' ? 'Image alt text' : 'Video caption',
        value: String(node.attrs[attr] ?? ''),
      })
      if (!destroyed && value !== null) setAttrs({ [attr]: value })
    })
    const more = nodeButton(`${kind === 'image' ? 'Image' : 'Video'} options`, 'more', () => {
      if (!view.editable) return
      menu.hidden = !menu.hidden
      more.setAttribute('aria-expanded', String(!menu.hidden))
      dom.classList.toggle('is-menu-open', !menu.hidden)
      if (!menu.hidden) positionMenu(menu)
    })
    more.setAttribute('aria-haspopup', 'menu')
    more.setAttribute('aria-expanded', 'false')
    function close() {
      menu.hidden = true
      more.setAttribute('aria-expanded', 'false')
      dom.classList.remove('is-menu-open')
    }
    const choices: Array<{ button: HTMLButtonElement; attr: string; value: string }> = []
    function item(label: string, action: () => unknown, attr?: string, value?: string) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'wysiwyg-md-media-menu-item'
      button.textContent = label
      button.setAttribute('role', attr ? 'menuitemradio' : 'menuitem')
      button.addEventListener('mousedown', (event) => event.preventDefault())
      button.addEventListener('click', () => {
        const result = action()
        close()
        if (result instanceof Promise) void result.then(() => view.focus())
        else view.focus()
      })
      menu.append(button)
      if (attr && value) choices.push({ button, attr, value })
      return button
    }
    function divider() { menu.append(document.createElement('hr')) }
    if (kind === 'image') {
      for (const size of ['small', 'medium', 'large', 'original']) {
        item(size[0]!.toUpperCase() + size.slice(1), () => setAttrs({ size }), 'size', size)
      }
      divider()
      for (const align of ['left', 'center', 'right']) item('Align ' + align, () => setAttrs({ align }), 'align', align)
      divider()
    } else {
      item('Change video URL', changeUrl)
      divider()
    }
    const remove = nodeButton('Delete', 'delete', () => {
      const pos = getPos()
      if (typeof pos !== 'number' || !view.editable) return
      view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize))
      view.focus()
    })
    remove.classList.add('is-danger')
    remove.setAttribute('role', 'menuitem')
    menu.append(remove)
    toolbar.append(replace, details, more, menu)
    frame.append(media, play, caption, toolbar)
    dom.append(frame, input)

    function applyAttrs() {
      if (media.getAttribute('src') !== node.attrs.src) media.setAttribute('src', node.attrs.src)
      media.title = node.attrs.title || ''
      if (media instanceof HTMLImageElement) media.alt = node.attrs.alt || ''
      dom.dataset.size = node.attrs.size || 'original'
      dom.dataset.align = node.attrs.align || 'left'
      caption.textContent = kind === 'video' ? node.attrs.title || '' : ''
      caption.hidden = !caption.textContent
      choices.forEach(({ button, attr, value }) => {
        button.setAttribute('aria-checked', String(node.attrs[attr] === value))
      })
    }
    function outside(event: PointerEvent) { if (!toolbar.contains(event.target as Node)) close() }
    function keydown(event: KeyboardEvent) { if (event.key === 'Escape' && !menu.hidden) { close(); more.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keydown)
    applyAttrs()
    return {
      dom,
      selectNode() { dom.classList.add('ProseMirror-selectednode') },
      deselectNode() { dom.classList.remove('ProseMirror-selectednode'); close() },
      update(updated) { if (updated.type !== node.type) return false; node = updated; applyAttrs(); return true },
      stopEvent(event) { return toolbar.contains(event.target as Node) || event.target === input || play.contains(event.target as Node) || (kind === 'video' && event.target === media) },
      ignoreMutation() { return true },
      destroy() {
        destroyed = true
        document.removeEventListener('pointerdown', outside)
        document.removeEventListener('keydown', keydown)
      },
    }
  }
}
