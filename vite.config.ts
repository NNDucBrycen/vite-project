import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

const spritePath = fileURLToPath(new URL('./public/sprite.svg', import.meta.url))
const normalizedSpritePath = spritePath.replace(/\\/g, '/').toLowerCase()
const virtualId = 'virtual:sprite-icons'
const resolvedId = `\0${virtualId}`

function spriteIconsPlugin(): Plugin {
  return {
    name: 'sprite-icons',
    resolveId(id) {
      if (id === virtualId) return resolvedId
    },
    load(id) {
      if (id !== resolvedId) return
      const source = readFileSync(spritePath, 'utf8')
      const svgSource = source.replace(/<!--[\s\S]*?-->/g, '')
      const icons: { name: string; description: string }[] = []
      const seen = new Set<string>()
      for (const tag of svgSource.matchAll(/<(?:svg|symbol)\b[^>]*>/gi)) {
        const match = /\bid\s*=\s*["']([A-Za-z][A-Za-z0-9_-]*)["']/i.exec(tag[0])
        if (!match || seen.has(match[1])) continue
        seen.add(match[1])
        const description = match[1].replace(/^icon-/, '').replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase())
        icons.push({ name: match[1], description })
      }
      const version = createHash('sha256').update(source).digest('hex').slice(0, 12)
      return `export const version = ${JSON.stringify(version)}; export default ${JSON.stringify(icons)};`
    },
    configureServer(server) {
      server.watcher.add(spritePath)
    },
    hotUpdate({ file }) {
      if (file.replace(/\\/g, '/').toLowerCase() !== normalizedSpritePath) return
      const module = this.environment.moduleGraph.getModuleById(resolvedId)
      if (!module) return []
      this.environment.moduleGraph.invalidateModule(module)
      return [module]
    },
  }
}

export default defineConfig({ plugins: [spriteIconsPlugin()] })
