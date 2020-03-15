let isRelevantData = false
let queryResult: string = ''

const START_STRING = '[TO_CLIENT_BEGIN]'
const PAUSE_STRING = '[TO_CLIENT_END]'
const END_STRING = '[END_CLIENT]'

interface Context {
  onStart?: (print: boolean) => void | Promise<void>
  onEnd?: () => void | Promise<void>
  handleToken?: (token: string, delimiter?: string) => void
  onStreamedToken?: (token: string, delimiter?: string) => void
}

let ctx: Context = {}

function onToken (print: boolean, token: string, delimiter: string): void {
  switch (token) {
    case START_STRING:
      isRelevantData = true

      if (ctx.onStart) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ctx.onStart(print)
      }
      return

    case PAUSE_STRING:
      isRelevantData = false
      return

    case END_STRING:
      if (print) {
        return
      }

      if (ctx.onEnd) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ctx.onEnd()
      }

      isRelevantData = false
      queryResult = ''
      return
  }

  if (isRelevantData) {
    if (ctx.handleToken && !print && token !== '') {
      ctx.handleToken(token, delimiter)
    }
  } else if (print) {
    process.stdout.write(`${token}${delimiter}`)
  }
}

/**
 * Goes through all tokens received from the C++ client from start 'till the
 * END_STRING signal
 */
function parseQueryResult (): void {
  let token: string = ''
  let char: string = ''

  for (let i = 0; i < queryResult.length - 1; i++) {
    char = queryResult.charAt(i)

    if (char === ' ' || char === '\n') {
      onToken(false, token, char)
      token = ''
    } else {
      token += char
    }
  }
}

export function setCtx (newCtx: Partial<Context>): void {
  ctx = { ...ctx, ...newCtx }
}

/**
 * Will be executed every time a chunk of data has been received from the C++
 * client in order to properly handle the input
 */
export function onQueryResult (chunk: Buffer): void {
  const line = chunk.toString()
  queryResult += line

  let token: string = ''
  let char: string = ''

  for (let i = 0; i < line.length - 1; i++) {
    char = line.charAt(i)

    // In case we've constructed a whole token, then handle it now!
    if (char === ' ' || char === '\n') {
      onToken(true, token, char)

      if (ctx.onStreamedToken) {
        ctx.onStreamedToken(token, char)
      }

      token = ''
    } else {
      token += char
    }
  }

  // In case our stream has ended, then we must assume the rest of our input is
  // a token in itself, and hence we handle it here
  onToken(true, token, '\n')

  // In case we've recieved the signal from C++ that we've gotten all relevant
  // data for an activity, then handle it now!
  if (chunk.includes(END_STRING)) {
    parseQueryResult()
  }
}
