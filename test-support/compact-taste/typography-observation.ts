// Local synthetic fixture only: bounded load/shift evidence exposed as DOM attributes.
// Never imported by production code, never records cookies, requests, bodies or users.
export {};
let cls = 0;
let windowValue = 0;
let windowStart = 0;
let lastShift = 0;
const shifts: { value: number; startTime: number; fontsLoading: boolean; sources: string[] }[] = [];
if (typeof PerformanceObserver !== 'undefined') {
  new PerformanceObserver(list => {
    for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node?: Element }[] })[]) {
      if (!entry.hadRecentInput) {
        if (shifts.length < 30) shifts.push({ value: entry.value, startTime: entry.startTime, fontsLoading: document.fonts.status === 'loading', sources: (entry.sources ?? []).map(source => source.node?.getAttribute?.('class') ?? source.node?.nodeName ?? 'unknown') });
        if (entry.startTime - lastShift > 1000 || entry.startTime - windowStart > 5000) {
          windowStart = entry.startTime;
          windowValue = 0;
        }
        windowValue += entry.value;
        lastShift = entry.startTime;
        cls = Math.max(cls, windowValue);
      }
    }
    document.documentElement.dataset.localCls = cls.toFixed(6);
    document.documentElement.dataset.localShifts = JSON.stringify(shifts);
  }).observe({ type: 'layout-shift', buffered: true });
}
document.documentElement.dataset.localCls = '0';
function recordFonts() {
  document.documentElement.dataset.localFontsReady = 'true';
  document.documentElement.dataset.localFontReadyMs = performance.now().toFixed(1);
  document.documentElement.dataset.localFontFaces = JSON.stringify(Array.from(document.fonts).map(face => ({ family: face.family, status: face.status, style: face.style })));
  document.documentElement.dataset.localFontResources = JSON.stringify(performance.getEntriesByType('resource').filter(entry => entry.name.includes('/fonts/')).map(entry => ({ path: new URL(entry.name).pathname, bytes: (entry as PerformanceResourceTiming).transferSize })));
}
document.fonts.addEventListener('loadingdone', recordFonts);
document.fonts.ready.then(recordFonts);
// CSS is imported by the fixture's separate module, so initial ready may precede it.
let fontFrames = 0;
function observeLoadedStyles() {
  if (document.fonts.size > 0) document.fonts.ready.then(recordFonts);
  else if (++fontFrames < 120) requestAnimationFrame(observeLoadedStyles);
}
requestAnimationFrame(observeLoadedStyles);
