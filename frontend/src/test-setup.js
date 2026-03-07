import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock ResizeObserver for Ant Design Table
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Patch getComputedStyle for libraries that pass pseudo elements in jsdom.
const originalGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = (element, pseudoElt) => {
  if (pseudoElt) {
    return originalGetComputedStyle(element)
  }
  return originalGetComputedStyle(element)
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock window.innerWidth
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  value: 1920,
})
