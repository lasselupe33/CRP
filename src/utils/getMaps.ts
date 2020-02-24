import { resolvePath } from './resolvePath'

import fs = require('fs-extra')

export function getMaps (folder: string): string[] {
  return fs.readdirSync(resolvePath(['data', folder]))
    .filter(map => map.endsWith('.osm') || map.endsWith('.bz2'))
}

export function getFolders (): string[] {
  return fs.readdirSync(resolvePath('data'), { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
}
