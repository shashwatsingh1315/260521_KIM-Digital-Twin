// Derived formulas (§15) — the ONLY place these are computed.
//
// Pure functions mapping config + inputs → computed values.
// Never hardcoded, never stored on entities. Used by engine, validator, and aggregator.

/**
 * Effective slots for a station process given assigned operators.
 * If operators_per_slot === 0 (fully automated), use all parallel_slots.
 * Otherwise, effective = min(parallel_slots, floor(operators / operators_per_slot)).
 *
 * When the caller does not specify how many operators are assigned, the nominal
 * (fully-staffed) capacity is assumed: enough operators to run every slot, i.e.
 * `parallel_slots × operators_per_slot`. (Defaulting to `parallel_slots` was a
 * bug — it under-staffs any process needing >1 operator per slot, yielding 0
 * effective slots whenever operators_per_slot > parallel_slots.)
 */
export function effectiveSlots(
  parallelSlots,
  operatorsPerSlot,
  assignedOperators = parallelSlots * operatorsPerSlot,
) {
  if (operatorsPerSlot === 0) {
    return parallelSlots;
  }
  return Math.min(parallelSlots, Math.floor(assignedOperators / operatorsPerSlot));
}

/**
 * Capacity per hour for a station process.
 * capacityPerHour = (3600 / takt_seconds) × effectiveSlots
 */
export function capacityPerHour(taktSeconds, effSlots) {
  return (3600 / taktSeconds) * effSlots;
}

/**
 * Effective throughput given capacity and shift availability.
 * effectiveThroughput = capacityPerHour × availability
 */
export function effectiveThroughput(capPerHour, availability = 1) {
  return capPerHour * availability;
}

/**
 * Shift availability — fraction of the shift the station is staffed.
 * Simple model: if a process is on the station and the shift covers it, availability = 1.
 * Otherwise 0. (Assumes single shift in config.)
 */
export function shiftAvailability(shiftDurationHours) {
  return Math.min(1, shiftDurationHours / 24);
}

/**
 * Identify the bottleneck process (minimum effective throughput).
 * Returns {station_id, process_id, throughput} or null if no processes.
 */
export function bottleneck(config) {
  let minProcess = null;
  let minThroughput = Infinity;

  for (const station of config.stations) {
    for (const stProc of station.processes) {
      const effSlots = effectiveSlots(stProc.parallel_slots, stProc.operators_per_slot);
      const capHr = capacityPerHour(stProc.takt_seconds, effSlots);
      const availability = shiftAvailability(
        config.shifts[0]?.duration_hours || 8,
      );
      const throughput = effectiveThroughput(capHr, availability);

      if (throughput < minThroughput) {
        minThroughput = throughput;
        minProcess = {
          station_id: station.id,
          process_id: stProc.process_id,
          throughput: minThroughput,
        };
      }
    }
  }

  return minProcess;
}

/**
 * Round-trip time for a carrier on a segment.
 * roundTripTime = load + (length / loaded_speed) + unload + (length / empty_speed)
 * All inputs in seconds (speed converted from m/min to m/s).
 */
export function roundTripTime(lengthM, loadUnloadSec, speedLoadedMPerMin, speedEmptyMPerMin) {
  const loadedTimeMin = lengthM / speedLoadedMPerMin;
  const emptyTimeMin = lengthM / speedEmptyMPerMin;
  return loadUnloadSec + loadedTimeMin * 60 + emptyTimeMin * 60;
}

/**
 * Throughput of a carrier pool (units/hour).
 * poolThroughput = count × units_per_trip × 3600 / roundTripTime × availability
 * AMRs have availability = 1; humans may be shift-gated.
 */
export function poolThroughput(count, unitsPerTrip, roundTripTimeSec, availability = 1) {
  return (count * unitsPerTrip * 3600) / roundTripTimeSec * availability;
}

/**
 * Throughput of a hold/store process (units/hour).
 * holdThroughput = (slots / dwell_seconds) × 3600
 */
export function holdThroughput(slots, dwellSeconds) {
  return (slots / dwellSeconds) * 3600;
}

/**
 * Total people required for a shift and station configuration.
 * Sum operators_per_slot × effective_slots across all shift-gated processes.
 */
export function peopleRequired(config, shiftId) {
  const shift = config.shifts.find((s) => s.id === shiftId);
  if (!shift) return 0;

  let total = 0;
  for (const station of config.stations) {
    for (const stProc of station.processes) {
      if (stProc.operators_per_slot === 0) continue; // Fully automated, no labor.
      const eff = effectiveSlots(stProc.parallel_slots, stProc.operators_per_slot);
      total += stProc.operators_per_slot * eff;
    }
  }

  // Add counts_as_labor carriers.
  for (const pool of config.carrierPools) {
    if (pool.counts_as_labor && pool.shift_gated) {
      total += pool.count;
    }
  }

  return total;
}

/**
 * AMR fleet required (total count of non-shift-gated carriers).
 * Simple: sum count for all shift_gated===false pools.
 */
export function amrFleet(config) {
  let total = 0;
  for (const pool of config.carrierPools) {
    if (!pool.shift_gated) {
      total += pool.count;
    }
  }
  return total;
}
