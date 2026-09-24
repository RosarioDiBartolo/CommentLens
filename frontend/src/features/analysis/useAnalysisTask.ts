import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

/** One independently cancellable task, retaining its last successful result. */
export function useAnalysisTask<Input, Output>(execute: (input: Input, signal: AbortSignal) => Promise<Output>) {
  const [data, setData] = useState<Output | null>(null)
  const active = useRef<AbortController | null>(null)
  const mutation = useMutation({
    mutationFn: ({ input, controller }: { input: Input; controller: AbortController }) => execute(input, controller.signal),
    retry: false,
    gcTime: 0,
    onSuccess: (result, { controller }) => { if (!controller.signal.aborted) setData(result) },
  })
  useEffect(() => () => { active.current?.abort() }, [])

  async function run(input: Input) {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    try {
      const result = await mutation.mutateAsync({ input, controller })
      return controller.signal.aborted ? undefined : result
    } catch {
      // The mutation exposes the error to its panel; sibling tasks keep running.
      return undefined
    } finally {
      if (active.current === controller) active.current = null
    }
  }

  function cancel() {
    active.current?.abort()
    active.current = null
    mutation.reset()
  }
  function reset() { cancel(); setData(null) }

  return { data, pending: mutation.isPending, error: mutation.error?.message, run, cancel, reset }
}
