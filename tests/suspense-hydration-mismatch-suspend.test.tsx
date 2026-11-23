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
