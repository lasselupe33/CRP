// eslint-disable-next-line @typescript-eslint/promise-function-async
export function asyncTimeout (timeout: number = 0): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout)
  })
}
