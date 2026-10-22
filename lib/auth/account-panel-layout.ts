type PanelAnchor = { left: number; right: number; top: number; bottom: number };
type PanelViewport = { left: number; top: number; width: number; height: number };

/** Absolute offsets within the account root, clamped to the visible viewport.
 * Keep the panel in DOM order for Tab; never depend on the avatar being rightmost.
 */
export function accountPanelLayout(anchor: PanelAnchor, viewport: PanelViewport) {
  const margin = 12;
  const width = Math.max(0, Math.min(280, viewport.width - margin * 2));
  const left = Math.max(viewport.left + margin,
    Math.min(anchor.right - width, viewport.left + viewport.width - margin - width));
  const bottom = viewport.top + viewport.height - margin;
  // Reserve enough space for a scrollable panel even with an on-screen keyboard.
  const top = Math.max(viewport.top + margin,
    Math.min(anchor.bottom + 8, bottom - Math.min(160, viewport.height - margin * 2)));
  return { left: left - anchor.left, top: top - anchor.top, width, maxHeight: Math.max(0, bottom - top) };
}
