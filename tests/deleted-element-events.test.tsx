import { afterEach, expect, it } from 'vitest'
import { useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

const cleanups: Array<() => void> = []
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup() })
const settle = () => new Promise(resolve => setTimeout(resolve))

function mount(element: any): HTMLElement {
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  flushSync(() => root.render(element))
  cleanups.push(() => { flushSync(() => root.unmount()); container.remove() })
  return container
}

it('does not run a blur handler on a focused input that a click removes', async () => {
  const calls: string[] = []
  function Form() {
    const [open, setOpen] = useState(true)
    if (!open) return <p>closed</p>
    return (
      <div>
        <input onBlur={() => calls.push('blur')} />
        <button onMouseDown={(event: { preventDefault(): void }) => event.preventDefault()} onClick={() => setOpen(false)}>Done</button>
      </div>
    )
  }
  const container = mount(<Form />)
  container.querySelector('input')!.focus()
  container.querySelector('button')!.click()
  await settle()
  expect(container.innerHTML).toBe('<p>closed</p>')
  expect(calls).toEqual([])
})

it('does not run handlers on an element whose removal is being committed', async () => {
  const calls: string[] = []
  function Field() {
    const ref = useRef<HTMLInputElement>(null)
    useLayoutEffect(() => () => ref.current?.blur(), [])
    return <input ref={ref} onBlur={() => calls.push('blur')} />
  }
  let close!: () => void
  function Form() {
    const [open, setOpen] = useState(true)
    close = () => setOpen(false)
    return open ? <div><Field /></div> : <p>closed</p>
  }
  const container = mount(<Form />)
  container.querySelector('input')!.focus()
  flushSync(close)
  await settle()
  expect(container.innerHTML).toBe('<p>closed</p>')
  expect(calls).toEqual([])
})
