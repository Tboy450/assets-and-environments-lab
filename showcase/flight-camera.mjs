const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
// Free-camera zoom multiplies the chase distance: in to about 2 m from the craft (to see detail
// such as the antenna's slots), out a little past the default view.
export const cameraZoomRange = Object.freeze({ min: 0.17, max: 1.6 });

export function wrapAngle(angle) {
  return ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

export function cameraPose(state) {
  const heading = -state.heading * Math.PI / 180;
  return {
    heading,
    azimuth: state.cameraMode === "free" ? state.cameraYaw : heading,
    elevation: state.cameraMode === "free" ? state.cameraPitch : 0.16,
    zoom: state.cameraMode === "free" ? clamp(state.cameraZoom ?? 1, cameraZoomRange.min, cameraZoomRange.max) : 1,
  };
}

// The rendered camera eases toward the requested pose, so switching Fixed/Free or turning
// never teleports the view. Free mode responds quickly enough to feel attached to the drag.
export function smoothCameraPose(state, dt) {
  const target = cameraPose(state);
  if (!state.renderPose || !(dt > 0)) {
    state.renderPose = { ...target };
    return state.renderPose;
  }
  const rate = state.cameraMode === "free" ? 18 : 5;
  const blend = 1 - Math.exp(-rate * Math.min(dt, 0.1));
  const pose = state.renderPose;
  pose.heading = target.heading;
  pose.azimuth = wrapAngle(pose.azimuth + wrapAngle(target.azimuth - pose.azimuth) * blend);
  pose.elevation += (target.elevation - pose.elevation) * blend;
  // Zoom eases in log space so each wheel step or pinch feels the same near and far.
  pose.zoom = Math.exp(Math.log(pose.zoom ?? 1) + (Math.log(target.zoom) - Math.log(pose.zoom ?? 1)) * blend);
  return pose;
}

export function enterFreeCamera(state) {
  // Start the orbit from what is on screen, including a camera still easing from a previous switch.
  const pose = state.renderPose || cameraPose(state);
  state.cameraYaw = wrapAngle(pose.azimuth);
  state.cameraPitch = clamp(pose.elevation, 0.04, 1.38);
}

// factor < 1 moves the free camera in, > 1 out.
export function zoomCamera(state, factor) {
  state.cameraZoom = clamp((state.cameraZoom ?? 1) * factor, cameraZoomRange.min, cameraZoomRange.max);
  return state.cameraZoom;
}

export function orbitCamera(state, dx, dy, width, height) {
  state.cameraYaw = wrapAngle(state.cameraYaw - dx / Math.max(1, width) * TAU);
  state.cameraPitch = clamp(state.cameraPitch + dy / Math.max(1, height) * Math.PI, 0.04, 1.38);
}
