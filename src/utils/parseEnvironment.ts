export const environment = {
  '--testAmount': 1000,
  '--experiment': '',
  '--metric': 'dist',
  '--recompile': false,
  '--folder': 'cph',
  '--skipParsingIfPossible': false,
  '--exitOnEnd': true
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
          // @ts-ignore
          environment[variable] = val
      }
    }
  }
}

parseEnvironment()
