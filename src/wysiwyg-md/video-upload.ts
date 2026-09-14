import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorState } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { EditorView } from 'prosemirror-view'
import type { UploadVideoFn } from './types'

interface PlaceholderId {
  readonly id: symbol
}

interface AddAction extends PlaceholderId {
  pos: number
  previewSrc: string
}

interface RemoveAction extends PlaceholderId {}

export const videoUploadKey = new PluginKey<DecorationSet>('wysiwyg-md-video-upload')

function findPlaceholder(state: EditorState, id: symbol): number | null {
  const decos = videoUploadKey.getState(state)
  if (!decos) return null
  const found = decos.find(undefined, undefined, (spec) => spec.id === id)
  return found.length ? found[0].from : null
}

export function videoUploadPlaceholderPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: videoUploadKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        set = set.map(tr.mapping, tr.doc)
        const add = tr.getMeta(videoUploadKey) as { add?: AddAction; remove?: RemoveAction } | undefined
        if (add?.add) {
          const widget = document.createElement('span')
          widget.className = 'wysiwyg-md-video-placeholder'
          const video = document.createElement('video')
          video.src = add.add.previewSrc
          widget.appendChild(video)
          set = set.add(tr.doc, [Decoration.widget(add.add.pos, widget, { id: add.add.id })])
        } else if (add?.remove) {
          const found = set.find(undefined, undefined, (spec) => spec.id === add.remove!.id)
          set = set.remove(found)
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

export function startVideoUpload(
  view: EditorView,
  file: File,
  uploadVideo: UploadVideoFn,
  onError?: (error: unknown, file: File) => void,
  pos?: number,
): void {
  const id = Symbol('video-upload')
  const previewSrc = URL.createObjectURL(file)
  const insertPos = pos ?? view.state.selection.from

  view.dispatch(
    view.state.tr.setMeta(videoUploadKey, { add: { id, pos: insertPos, previewSrc } satisfies AddAction }),
  )

  uploadVideo(file)
    .then((url) => {
      const at = findPlaceholder(view.state, id)
      let tr = view.state.tr.setMeta(videoUploadKey, { remove: { id } satisfies RemoveAction })
      if (at != null) {
        tr = tr.replaceWith(at, at, view.state.schema.nodes.video.create({ src: url }))
      }
      view.dispatch(tr)
      URL.revokeObjectURL(previewSrc)
    })
    .catch((err: unknown) => {
      view.dispatch(view.state.tr.setMeta(videoUploadKey, { remove: { id } satisfies RemoveAction }))
      URL.revokeObjectURL(previewSrc)
      onError?.(err, file)
    })
}

export function videoPasteDropPlugin(
  uploadVideo: UploadVideoFn,
  onError?: (error: unknown, file: File) => void,
): Plugin {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
          i.type.startsWith('video/'),
        )
        const file = item?.getAsFile()
        if (!file) return false
        startVideoUpload(view, file, uploadVideo, onError)
        return true
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith('video/'),
        )
        if (!files.length) return false
        event.preventDefault()
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
        const pos = coords?.pos
        files.forEach((f) => startVideoUpload(view, f, uploadVideo, onError, pos))
        return true
      },
    },
  })
}
