import { useState, useEffect, useCallback } from 'react'

type AsyncState<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'success'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: string }

const LOADING: AsyncState<never> = { status: 'loading', data: undefined, error: undefined }

/**
 * Runs an async factory on mount (and whenever deps change).
 * Returns { status, data, error, reload }.
 */
export function useAsync<T>(
  factory: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: any[] = [],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>(LOADING)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setState(LOADING)
    factory()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data, error: undefined })
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            data: undefined,
            error: err instanceof Error ? err.message : 'שגיאה לא ידועה',
          })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, reload }
}
