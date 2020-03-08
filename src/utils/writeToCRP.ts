import { Writable } from 'stream'

export function writeToCRP (crpStream: Writable, text: string): void {
  crpStream.write(`${text}\n`)
}
