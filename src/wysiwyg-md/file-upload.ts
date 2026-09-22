import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { EditorView } from 'prosemirror-view'
import type { UploadFileFn } from './types'

interface PlaceholderId {
  readonly id: symbol
}

interface AddAction extends PlaceholderId {
  pos: number
  name: string
}

interface RemoveAction extends PlaceholderId {}

export const fileUploadKey = new PluginKey<DecorationSet>('wysiwyg-md-file-upload')

function findPlaceholder(state: EditorState, id: symbol): number | null {
  const decos = fileUploadKey.getState(state)
  if (!decos) return null
  const found = decos.find(undefined, undefined, (spec) => spec.id === id)
  return found.length ? found[0].from : null
}

export function fileUploadPlaceholderPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: fileUploadKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        set = set.map(tr.mapping, tr.doc)
        const action = tr.getMeta(fileUploadKey) as { add?: AddAction; remove?: RemoveAction } | undefined
        if (action?.add) {
          const widget = document.createElement('span')
          widget.className = 'wysiwyg-md-file-placeholder'
          widget.textContent = `Uploading ${action.add.name}…`
          widget.setAttribute('aria-label', `Uploading ${action.add.name}`)
          set = set.add(tr.doc, [Decoration.widget(action.add.pos, widget, { id: action.add.id })])
        } else if (action?.remove) {
          set = set.remove(set.find(undefined, undefined, (spec) => spec.id === action.remove!.id))
        }
        return set
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
}

export function startFileUpload(
  view: EditorView,
  file: File,
  uploadFile: UploadFileFn,
  onError?: (error: unknown, file: File) => void,
  pos?: number,
): void {
  const id = Symbol('file-upload')
  const insertPos = pos ?? view.state.selection.from

  view.dispatch(
    view.state.tr.setMeta(fileUploadKey, { add: { id, pos: insertPos, name: file.name } satisfies AddAction }),
  )

  uploadFile(file)
    .then((url) => {
      const at = findPlaceholder(view.state, id)
      let tr = view.state.tr.setMeta(fileUploadKey, { remove: { id } satisfies RemoveAction })
      if (at != null) {
        const link = view.state.schema.marks.link.create({ href: url })
        tr = tr.replaceWith(at, at, view.state.schema.text(file.name, [link]))
      }
      view.dispatch(tr)
    })
    .catch((err: unknown) => {
      view.dispatch(view.state.tr.setMeta(fileUploadKey, { remove: { id } satisfies RemoveAction }))
      onError?.(err, file)
    })
}

function isAttachment(file: File): boolean {
  return !file.type.startsWith('image/') && !file.type.startsWith('video/')
}

export function filePasteDropPlugin(
  uploadFile: UploadFileFn,
  onError?: (error: unknown, file: File) => void,
): Plugin {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const item = Array.from(event.clipboardData?.items ?? []).find((item) => {
          const file = item.getAsFile()
          return item.kind === 'file' && file != null && isAttachment(file)
        })
        const file = item?.getAsFile()
        if (!file) return false
        startFileUpload(view, file, uploadFile, onError)
        return true
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter(isAttachment)
        if (!files.length) return false
        event.preventDefault()
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
        const pos = coords?.pos
        files.forEach((file) => startFileUpload(view, file, uploadFile, onError, pos))
        return true
      },
    },
  })
}
