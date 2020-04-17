// eslint-disable-next-line @typescript-eslint/promise-function-async
export function waitForUserInput (): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stdin.resume()
    process.stdin.once('data', data => resolve(data.toString().trim()))
    process.stdin.once('error', reject)
  })
}
