export const environment = {
  '--testAmount': 1000,
  '--experiment': '',
  '--metric': 'dist',
  '--recompile': false,
  '--folder': 'cph',
  '--skipParsingIfPossible': false,
  '--exitOnEnd': true,
  '--maxThreads': 4,

  // traffic specific environment variables
  '--skipVisualise': false,
  '--skipExtractingCorners': false,
  '--verticesToExtract': 0,

  // Scale specific tests
  '--scales': [2 ** 12, 2 ** 15, 2 ** 18, 2 ** 21, 2 ** 22, 2 ** 23, 2 ** 24, 2 ** 25],
  '--avgDegree': 2.1
}

export type Environment = typeof environment

function parseEnvironment (): void {
  const variables = Object.keys(environment)

  for (const arg of process.argv) {
    if (arg === '--help') {
      console.log('Supported variables:')

      for (const variable of variables) {
        console.log(`${variable}=${typeof environment[variable as keyof Environment]}`)
      }

      process.exit(0)
    }

    const variable = variables.find(it => arg.includes(it))
    if (variable) {
      const val = arg.split('=')[1]

      switch (typeof environment[variable as keyof Environment]) {
        case 'number':
          // @ts-ignore
          environment[variable] = Number(val)
          break

        case 'boolean':
          // @ts-ignore
          environment[variable] = val !== 'false'
          break

        default:
          if (val.includes(',')) {
            // @ts-ignore
            environment[variable] = val.split(',').map(Number)
          } else {
            // @ts-ignore
            environment[variable] = val
          }
      }
    }
  }
}

parseEnvironment()
