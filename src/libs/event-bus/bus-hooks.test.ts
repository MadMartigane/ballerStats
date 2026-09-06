import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBusList, onBusEvent } from './bus-hooks'
import bsEventBus from './event-bus'

const TEAMS_CHANGE = 'BS::TEAMS::CHANGE'

describe('createBusList', () => {
  it('returns the initial list', () => {
    createRoot((dispose) => {
      const list = createBusList(TEAMS_CHANGE, () => [1])
      expect(list()).toEqual([1])
      dispose()
    })
  })

  it('re-reads the list when the bus event fires', () => {
    createRoot((dispose) => {
      let items = [1]
      const list = createBusList(TEAMS_CHANGE, () => items)
      items = [1, 2]
      bsEventBus.dispatchEvent(TEAMS_CHANGE)
      expect(list()).toEqual([1, 2])
      dispose()
    })
  })

  it('re-reads the list on the local subscribe notifier without a bus event', () => {
    createRoot((dispose) => {
      let items = [1]
      let trigger: (() => void) | undefined
      const list = createBusList(
        TEAMS_CHANGE,
        () => items,
        (listener) => {
          trigger = listener
          return () => undefined
        }
      )
      items = [1, 2, 3]
      trigger?.()
      expect(list()).toEqual([1, 2, 3])
      dispose()
    })
  })

  it('stops refreshing after the owner disposes', () => {
    let items = [1]
    let list: () => number[] = () => []
    const dispose = createRoot((d) => {
      list = createBusList(TEAMS_CHANGE, () => items)
      return d
    })
    dispose()
    items = [1, 2]
    bsEventBus.dispatchEvent(TEAMS_CHANGE)
    expect(list()).toEqual([1])
  })
})

describe('onBusEvent', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('removes the listener on dispose', () => {
    const removeSpy = vi.spyOn(bsEventBus, 'removeEventListener')
    const handler = () => undefined
    const dispose = createRoot((d) => {
      onBusEvent(TEAMS_CHANGE, handler)
      return d
    })
    dispose()
    expect(removeSpy).toHaveBeenCalledWith(TEAMS_CHANGE, handler)
  })
})
