import { expect, it, vi } from 'vitest'
import * as React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

it('shows the fallback when a boundary suspends while recovering from a hydration mismatch', async () => {
  const container = document.body.appendChild(document.createElement('div'))
  container.innerHTML = '<main><!--$--><span>Server</span><p>Lazy</p><!--/$--></main>'

  let resolveLazy!: () => void
  const lazy = new Promise<void>(resolve => { resolveLazy = resolve })
  let lazyDone = false
  lazy.then(() => { lazyDone = true })

  // A code-split component whose chunk is not loaded yet on the client.
  function Lazy() {
    if (!lazyDone) throw lazy
    return <p>Lazy</p>
  }

  const uncaught: unknown[] = []
  const onError = (event: ErrorEvent) => {
    uncaught.push(event.error)
    event.preventDefault()
  }
  window.addEventListener('error', onError)

  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    // `<em>` mismatches the server `<span>`, so the boundary client-renders
    // and `Lazy` suspends during that recovery render.
    root = hydrateRoot(
      container,
      <main><React.Suspense fallback={<i>Loading</i>}><em>Client</em><Lazy /></React.Suspense></main>,
      { onUncaughtError: error => uncaught.push(error), onRecoverableError: () => {} },
    )
  } catch (error) {
    uncaught.push(error)
  }

  try {
    expect(uncaught).toEqual([])

    resolveLazy()
    await vi.waitFor(() => expect(container.querySelector('main')!.textContent).toBe('ClientLazy'))
    expect(uncaught).toEqual([])
  } finally {
    resolveLazy()
    window.removeEventListener('error', onError)
    if (root) flushSync(() => root!.unmount())
    container.remove()
  }
})

it('shows the fallback when the mismatch recovery runs on a root hydration retry', async () => {
  const container = document.body.appendChild(document.createElement('div'))
  container.innerHTML = '<main><!--$--><span>Server</span><p>Lazy</p><!--/$--></main>'

  const pending = () => {
    let resolve!: () => void
    let done = false
    const promise = new Promise<void>(r => { resolve = r }).then(() => { done = true })
    return { promise, resolve, done: () => done }
  }
  const gate = pending()
  const fallback = pending()
  const lazy = pending()

  // Suspends outside any boundary, so the root retries hydration once it settles.
  function Gate() {
    if (!gate.done()) throw gate.promise
    return null
  }
  // A code-split fallback, like a lazy route pending component.
  function Fallback() {
    if (!fallback.done()) throw fallback.promise
    return <i>Loading</i>
  }
  function Lazy() {
    if (!lazy.done()) throw lazy.promise
    return <p>Lazy</p>
  }

  const uncaught: unknown[] = []
  const onRejection = (reason: unknown) => { uncaught.push(reason) }
  process.on('unhandledRejection', onRejection)

  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    root = hydrateRoot(
      container,
      <main><Gate /><React.Suspense fallback={<Fallback />}><em>Client</em><Lazy /></React.Suspense></main>,
      { onUncaughtError: error => uncaught.push(error), onRecoverableError: () => {} },
    )

    gate.resolve()
    fallback.resolve()
    await vi.waitFor(() => expect(container.querySelector('main')!.innerHTML).toBe('<!--$--><i>Loading</i><!--/$-->'))
    expect(uncaught).toEqual([])

    lazy.resolve()
    await vi.waitFor(() => expect(container.querySelector('main')!.textContent).toBe('ClientLazy'))
    expect(uncaught).toEqual([])
  } finally {
    gate.resolve()
    fallback.resolve()
    lazy.resolve()
    process.off('unhandledRejection', onRejection)
    if (root) flushSync(() => root!.unmount())
    container.remove()
  }
})
