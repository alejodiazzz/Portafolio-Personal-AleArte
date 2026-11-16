import { useEffect, useState, type DependencyList } from 'react'
import { toUserMessage } from './errors'

export type AsyncState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: T }

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    fn().then(
      (data) => alive && setState({ status: 'ok', data }),
      (err) => alive && setState({ status: 'error', message: toUserMessage(err) }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
