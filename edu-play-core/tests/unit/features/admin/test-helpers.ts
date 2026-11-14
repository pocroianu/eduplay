import { vi } from 'vitest'

class AdminResizeObserverMock {
  observe() {
    return undefined
  }

  unobserve() {
    return undefined
  }

  disconnect() {
    return undefined
  }
}

export function installAdminTableDomMocks() {
  vi.stubGlobal('ResizeObserver', AdminResizeObserverMock)
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: AdminResizeObserverMock,
  })
  Element.prototype.scrollIntoView = () => {}
}
