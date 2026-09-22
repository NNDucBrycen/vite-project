export type NodeIcon = 'replace' | 'image' | 'caption' | 'more' | 'delete' | 'edit' | 'code' | 'row' | 'column'

const paths: Record<NodeIcon, string> = {
  replace: 'M14 6A6 6 0 0 0 3.5 4L1 7m0-4v4h4M2 10a6 6 0 0 0 10.5 2L15 9m0 4V9h-4',
  image: 'M2 2h12v12H2zM2 11l4-4 3 3 2-2 3 3M5 5h.01',
  caption: 'M2 2h12v10H8l-4 3v-3H2z',
  more: 'M8 3h.01M8 8h.01M8 13h.01',
  delete: 'M2 4h12M6 4V2h4v2M4 4l.5 10h7L12 4M6.5 7v4M9.5 7v4',
  edit: 'm3 10 8-8 3 3-8 8-4 1zM9 4l3 3',
  code: 'm5 4-4 4 4 4m6-8 4 4-4 4M9.5 2l-3 12',
  row: 'M2 3h4m4 0h4M2 13h4m4 0h4M3 8h10M8 6v4',
  column: 'M3 2v4m0 4v4M13 2v4m0 4v4M8 3v10M6 8h4',
}

export function nodeIcon(name: NodeIcon): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('aria-hidden', 'true')
  svg.innerHTML = `<path d="${paths[name]}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
  return svg
}

export function nodeButton(label: string, icon: NodeIcon, action: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'wysiwyg-md-node-button'
  button.title = label
  button.setAttribute('aria-label', label)
  button.append(nodeIcon(icon))
  if (icon !== 'more') button.append(document.createTextNode(label))
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', action)
  return button
}

/** Keep floating menus inside the viewport, including in narrow editor embeds. */
export function positionMenu(menu: HTMLElement) {
  menu.style.removeProperty('transform')
  const bounds = menu.getBoundingClientRect()
  const shift = Math.max(8 - bounds.left, Math.min(0, window.innerWidth - bounds.right - 12))
  if (shift) menu.style.transform = `translateX(${shift}px)`
}
