const stoppedRotors = Object.freeze(Array(8).fill(0));

// The clean-room portrait is independent of the flight and never changes its state.
export function missionVehicleState(state, parked = false) {
  return parked ? {
    ...state, heading: 90, pitch: 0, roll: 0, altitude: 0, speed: 0, verticalSpeed: 0,
    throttle: 0, missionTime: 0, antennaDeploy: 0, rotorRpm: stoppedRotors, rotorPhase: stoppedRotors,
    science: { ...state.science, sampling: false, sampleSeconds: 0, samples: [] },
  } : state;
}
