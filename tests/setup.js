// jsdom lacks a few browser APIs the app's components touch.
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {}
    })
  }
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  window.IntersectionObserver ||= NoopObserver
  window.ResizeObserver ||= NoopObserver
  window.scrollTo ||= () => {}
}
