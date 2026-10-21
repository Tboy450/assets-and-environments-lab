// Pointer intent only; the mission UI resolves selection, orders and camera movement.
export function pointerIntent(event) {
  const mouse = event.pointerType === 'mouse' || !event.pointerType;
  const button = event.button ?? 0;
  if (![0, 1, 2].includes(button) || (!mouse && button !== 0)) return null;
  return {
    action: event.altKey || button === 1 ? null : mouse ? button === 2 ? 'order' : 'select' : 'smart',
    rotate: button === 1 || button === 2 || !!event.altKey || !!event.ctrlKey,
    additive: !!(event.shiftKey || event.ctrlKey || event.metaKey),
    buttons: button === 2 ? 2 : button === 1 ? 4 : 1,
  };
}

export function exceedsTapSlop(start, point) {
  return Math.hypot(point.clientX - start.x, point.clientY - start.y) > 8;
}
