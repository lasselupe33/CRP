
export async function handleUncaughtException (shutdown: () => Promise<void>, err: unknown): Promise<void> {
  if (err instanceof Error) {
    console.error('Uncaught exception: ', err.message)
    console.error(err.stack)
  } else {
    console.error('Uncaught exception: ', err)
  }

  await shutdown()
  process.exit(1)
}
