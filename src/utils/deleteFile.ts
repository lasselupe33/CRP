import fs = require('fs');

export function deleteFile (file: string): void {
  try {
    fs.unlinkSync(file)
  } catch {

  }
}
