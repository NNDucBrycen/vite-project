type TextDialogOptions = {
  title: string
  value?: string
  multiline?: boolean
  confirmLabel?: string
}

let nextDialogId = 0

/** Opens a native modal dialog and returns null when it is dismissed. */
export function openTextDialog({ title, value = '', multiline = false, confirmLabel = 'Save' }: TextDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'wysiwyg-md-dialog'
    const form = document.createElement('form')
    const heading = document.createElement('h2')
    heading.id = `wysiwyg-md-dialog-title-${++nextDialogId}`
    heading.textContent = title
    dialog.setAttribute('aria-labelledby', heading.id)

    const field = multiline ? document.createElement('textarea') : document.createElement('input')
    field.className = 'wysiwyg-md-dialog-field'
    field.setAttribute('aria-label', title)
    field.value = value
    if (multiline) {
      field.classList.add('is-multiline')
      field.spellcheck = false
    }

    const actions = document.createElement('div')
    actions.className = 'wysiwyg-md-dialog-actions'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', () => dialog.close())
    const confirm = document.createElement('button')
    confirm.type = 'submit'
    confirm.className = 'is-primary'
    confirm.textContent = confirmLabel
    actions.append(cancel, confirm)
    form.append(heading, field, actions)
    dialog.append(form)

    let submitted = false
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      submitted = true
      dialog.close()
    })
    dialog.addEventListener('close', () => {
      dialog.remove()
      resolve(submitted ? field.value : null)
    }, { once: true })
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close()
    })

    document.body.append(dialog)
    dialog.showModal()
    field.focus()
    field.select()
  })
}
