import fs = require('fs-extra')

export function prependFile (filename: string, content: string): void {
  const data = fs.readFileSync(filename)
  const fd = fs.openSync(filename, 'w+')
  const insert = Buffer.from(content)
  fs.writeSync(fd, insert, 0, insert.length, 0)
  fs.writeSync(fd, data, 0, data.length, insert.length)
  fs.close(fd, (err) => {
    if (err) throw err
  })
}
