import { CAPTIONS, captionKey } from './captions'
import { positionMenu } from './node-ui'

export interface CaptionPickerHandle {
  wrap: HTMLElement
  open: () => void
  close: () => void
  isOpen: () => boolean
  destroy: () => void
}

export function createCaptionPicker(trigger: HTMLButtonElement, onSelect: (key: string) => void): CaptionPickerHandle {
  const wrap = document.createElement('div')
  wrap.className = 'wysiwyg-md-menu-wrap wysiwyg-md-caption-picker-wrap'
  trigger.setAttribute('aria-haspopup', 'dialog')
  trigger.setAttribute('aria-expanded', 'false')

  const panel = document.createElement('div')
  panel.className = 'wysiwyg-md-emoji-panel wysiwyg-md-caption-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Caption picker')
  panel.hidden = true

  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'wysiwyg-md-emoji-search'
  search.placeholder = 'Search labels or IDs'
  search.setAttribute('aria-label', 'Search labels or IDs')

  const body = document.createElement('div')
  body.className = 'wysiwyg-md-emoji-body wysiwyg-md-caption-list'
  panel.append(search, body)
  wrap.append(trigger, panel)

  function render(): void {
    body.replaceChildren()
    const query = search.value.trim().toLocaleLowerCase()
    const matches = CAPTIONS.filter((caption) =>
      !query || `${caption.LABEL} ${captionKey(caption)}`.toLocaleLowerCase().includes(query),
    )
    if (!matches.length) {
      const empty = document.createElement('div')
      empty.className = 'wysiwyg-md-emoji-message'
      empty.textContent = 'No labels found'
      body.append(empty)
      return
    }
    for (const caption of matches) {
      const key = captionKey(caption)
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'wysiwyg-md-caption-item'
      item.setAttribute('aria-label', `${caption.LABEL} ${key}`)
      const label = document.createElement('span')
      label.className = 'wysiwyg-md-caption-item-label'
      label.textContent = caption.LABEL
      const code = document.createElement('span')
      code.className = 'wysiwyg-md-caption-item-key'
      code.textContent = key
      item.append(label, code)
      item.addEventListener('mousedown', (event) => event.preventDefault())
      item.addEventListener('click', () => {
        close()
        onSelect(key)
      })
      body.append(item)
    }
  }

  function close(): void {
    panel.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
  }

  function open(): void {
    panel.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    search.value = ''
    render()
    positionMenu(panel)
    search.focus()
  }

  search.addEventListener('input', () => {
    render()
    body.scrollTop = 0
  })
  const onResize = () => {
    if (!panel.hidden) positionMenu(panel)
  }
  window.addEventListener('resize', onResize)

  return {
    wrap,
    open,
    close,
    isOpen: () => !panel.hidden,
    destroy: () => {
      window.removeEventListener('resize', onResize)
      close()
      wrap.remove()
    },
  }
}
