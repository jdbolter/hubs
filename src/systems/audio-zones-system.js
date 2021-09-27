// We apply the most restrictive audio parameters
function paramsReducer(acc, curr) {
  if (!curr) return;
  if (acc === null) acc = curr;
  if (curr.gain !== undefined) {
    acc.gain = Math.min(acc.gain, curr.gain);
  }
  if (curr.maxDistance !== undefined) {
    acc.maxDistance = Math.min(acc.maxDistance, curr.maxDistance);
  }
  if (curr.refDistance !== undefined) {
    acc.refDistance = Math.min(acc.refDistance, curr.refDistance);
  }
  if (curr.rolloffFactor !== undefined) {
    acc.rolloffFactor = Math.max(acc.rolloffFactor, curr.rolloffFactor);
  }
  if (curr.coneInnerAngle !== undefined) {
    acc.coneInnerAngle = Math.min(acc.coneInnerAngle, curr.coneInnerAngle);
  }
  if (curr.coneOuterAngle !== undefined) {
    acc.coneOuterAngle = Math.min(acc.coneOuterAngle, curr.coneOuterAngle);
  }
  if (curr.coneOuterGain !== undefined) {
    acc.coneOuterGain = Math.min(acc.coneOuterGain, curr.coneOuterGain);
  }
  return acc;
}

function addOrRemoveZone(zones, zone, position) {
  const isInZone = zone.isEnabled() && zone.contains(position);
  const wasInZone = zones.has(zone);
  if (isInZone && !wasInZone) {
    zones.add(zone);
  } else if (!isInZone && wasInZone) {
    zones.delete(zone);
  }
}

function any(set, predicate) {
  for (const item of set) {
    if (predicate(item)) return true;
  }
  return false;
}

function isUpdated(currZones, prevZones) {
  return currZones.size !== prevZones.size || any(currZones, zone => !prevZones.has(zone));
}

const setRay = (function() {
  const direction = new THREE.Vector3();
  return function setRay(ray, from, to) {
    ray.set(from, direction.subVectors(to, from).normalize());
  };
})();

function exclude(zones) {
  return zone => {
    return !zones.has(zone);
  };
}

function hasIntersection(ray) {
  const intersectTarget = new THREE.Vector3();
  return zone => {
    ray.intersectBox(zone.getBoundingBox(), intersectTarget);
    return intersectTarget !== null;
  };
}
const updateSource = (function() {
  const ray = new THREE.Ray();
  return function updateSource(source, sourcePosition, sourceZones, listenerPosition, listenerZones) {
    setRay(ray, listenerPosition, sourcePosition);

    // TODO: Reimplement the desired sorting of zones
    const inOutParams = Array.from(sourceZones)
      .filter(zone => zone.data.inOut)
      .filter(exclude(listenerZones))
      .filter(hasIntersection(ray))
      .map(zone => zone.getAudioParams())
      .reduce(paramsReducer, null);

    // TODO: Reimplement the desired sorting of zones
    const outInParams = Array.from(listenerZones)
      .filter(zone => zone.data.outIn)
      .filter(exclude(sourceZones))
      .filter(hasIntersection(ray))
      .map(zone => zone.getAudioParams())
      .reduce(paramsReducer, null);

    if (!outInParams && !inOutParams) {
      source.restore();
    } else if (outInParams && !inOutParams) {
      source.apply(outInParams);
    } else if (!outInParams && inOutParams) {
      source.apply(inOutParams);
    } else {
      const params = outInParams;
      if (outInParams.gain !== undefined && inOutParams.gain !== undefined) {
        params.gain = Math.min(outInParams.gain, inOutParams.gain);
      } else if (outInParams.gain === undefined && inOutParams.gain !== undefined) {
        params.gain = inOutParams.gain;
      } else if (outInParams.gain !== undefined && inOutParams.gain === undefined) {
        params.gain = outInParams.gain;
      }
      if (outInParams.coneOuterAngle !== undefined && inOutParams.coneOuterAngle !== undefined) {
        params.coneOuterAngle = Math.min(outInParams.coneOuterAngle, inOutParams.coneOuterAngle);
      } else if (outInParams.coneOuterAngle === undefined && inOutParams.coneOuterAngle !== undefined) {
        params.coneOuterAngle = inOutParams.coneOuterAngle;
      } else if (outInParams.coneOuterAngle !== undefined && inOutParams.coneOuterAngle === undefined) {
        params.coneOuterAngle = outInParams.coneOuterAngle;
      }
      source.apply(params);
    }
  };
})();

export class AudioZonesSystem {
  constructor() {
    this.zones = [];
    this.sources = [];
    this.entities = [];
    this.currZones = new Map();
    this.prevZones = new Map();
    this.didRegisterAudioListener = false;
  }
  registerZone(zone) {
    this.zones.push(zone);
  }
  unregisterZone(zone) {
    this.zones.splice(this.zones.indexOf(zone), 1);
    this.entities.forEach(entity => {
      this.currZones.get(entity).delete(zone);
    });
  }
  registerSource(source) {
    this.sources.push(source);
    this.registerEntity(source);
  }
  unregisterSource(source) {
    this.sources.splice(this.sources.indexOf(source), 1);
    this.unregisterEntity(source);
  }
  registerEntity(entity) {
    this.entities.push(entity);
    this.currZones.set(entity, new Set());
    this.prevZones.set(entity, new Set());
  }
  unregisterEntity(entity) {
    this.entities.splice(this.entities.indexOf(entity), 1);
    this.currZones.delete(entity);
    this.prevZones.delete(entity);
  }

  tick = (function() {
    const listenerPosition = new THREE.Vector3();
    return function(scene) {
      if (!scene.is("entered")) return;

      if (!this.didRegisterAudioListener) {
        this.didRegisterAudioListener = true;
        this.registerEntity(scene.audioListener);
      }

      const currListenerZones = this.currZones.get(scene.audioListener);
      scene.audioListener.getWorldPosition(listenerPosition);
      this.zones.forEach(zone => {
        addOrRemoveZone(currListenerZones, zone, listenerPosition);
        this.sources.forEach(source => {
          addOrRemoveZone(this.currZones.get(source), zone, source.getPosition());
        });
      });

      const isListenerUpdated = isUpdated(currListenerZones, this.prevZones.get(scene.audioListener));
      this.sources
        .filter(source => {
          return isListenerUpdated || isUpdated(this.currZones.get(source), this.prevZones.get(source));
        })
        .forEach(source => {
          updateSource(source, source.getPosition(), this.currZones.get(source), listenerPosition, currListenerZones);
        });

      this.entities.forEach(entity => {
        const prevZones = this.prevZones.get(entity);
        prevZones.clear();
        this.currZones.get(entity).forEach(zone => prevZones.add(zone));
      });
    };
  })();
}
