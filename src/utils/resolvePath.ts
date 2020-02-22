import path = require('path')

export function resolvePath(pth: string): string
export function resolvePath(pth: string[]): string
export function resolvePath (pth: string | string[]): string {
  return path.resolve(__dirname, '..', '..', ...(Array.isArray(pth) ? pth : [pth]))
}
