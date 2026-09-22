import icons, { version } from 'virtual:sprite-icons'

export type SvgIcon = { name: string; description: string }
export const SVG_ICONS_UPDATED_EVENT = 'wysiwyg-md-svg-icons-updated'
export const SVG_ICONS: SvgIcon[] = [...icons]
let spriteVersion = version

export function svgIconHref(name: string): string {
  return `/sprite.svg?v=${spriteVersion}#${name}`
}

if (import.meta.hot) {
  import.meta.hot.accept('virtual:sprite-icons', (module) => {
    if (!module) return
    SVG_ICONS.splice(0, SVG_ICONS.length, ...module.default)
    spriteVersion = module.version
    document.querySelectorAll('.wysiwyg-md-content svg.icon use').forEach((use) => {
      const name = use.getAttribute('href')?.split('#')[1]
      if (name) use.setAttribute('href', svgIconHref(name))
    })
    window.dispatchEvent(new Event(SVG_ICONS_UPDATED_EVENT))
  })
}

export function getSvgIcon(name: string): SvgIcon | undefined {
  return SVG_ICONS.find((icon) => icon.name === name)
}

export function createSvgIcon(name: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'icon')
  svg.setAttribute('width', '24')
  svg.setAttribute('height', '24')
  svg.setAttribute('fill', 'currentColor')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', getSvgIcon(name)?.description ?? name)

  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use')
  use.setAttribute('href', svgIconHref(name))
  svg.append(use)
  return svg
}
