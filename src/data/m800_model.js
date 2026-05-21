// M800 Modular Digital Twin Database — Baseline Configuration
// Source: Flow M800.xlsx discussion and extracted process flow
// Dashboard reads this as configuration. Adding/removing a node, path, or process
// is a data edit here — not a code change in the renderer or simulation.

// ─── 1. PHYSICAL STRUCTURE ────────────────────────────────────────────────────

export const location_node = [
  // Sites
  { location_id: 'LOC-KMP', parent_location_id: null, location_name: 'KMP Plant', location_type: 'site', site: 'KMP', floor: null, block: null, zone: null, capacity: null, initial_fill_ratio: null, status: 'active' },
  { location_id: 'LOC-WH', parent_location_id: null, location_name: 'Warehouse', location_type: 'site', site: 'WH', floor: null, block: null, zone: null, capacity: null, initial_fill_ratio: null, status: 'active' },
  { location_id: 'EXTERNAL-SUPPLIER', parent_location_id: null, location_name: 'Supplier Site', location_type: 'external', site: 'EXT', floor: null, block: null, zone: 'Supplier', capacity: null, initial_fill_ratio: null, status: 'active' },
  { location_id: 'LOC-CUSTOMER', parent_location_id: null, location_name: 'Customer Site', location_type: 'external', site: 'EXT', floor: null, block: null, zone: 'Customer', capacity: null, initial_fill_ratio: null, status: 'active' },

  // KMP floors
  { location_id: 'LOC-KMP-GF', parent_location_id: 'LOC-KMP', location_name: 'KMP Ground Floor', location_type: 'floor', site: 'KMP', floor: 'GF', block: null, zone: null, capacity: null, initial_fill_ratio: null, status: 'active' },
  { location_id: 'LOC-KMP-FF', parent_location_id: 'LOC-KMP', location_name: 'KMP First Floor',  location_type: 'floor', site: 'KMP', floor: 'FF', block: null, zone: null, capacity: null, initial_fill_ratio: null, status: 'active' },
  { location_id: 'LOC-KMP-SF', parent_location_id: 'LOC-KMP', location_name: 'KMP Second Floor', location_type: 'floor', site: 'KMP', floor: 'SF', block: null, zone: null, capacity: null, initial_fill_ratio: null, status: 'active' },
  { location_id: 'LOC-KMP-3F', parent_location_id: 'LOC-KMP', location_name: 'KMP Third Floor',  location_type: 'floor', site: 'KMP', floor: '3F', block: null, zone: null, capacity: null, initial_fill_ratio: null, status: 'active' },

  // WH floors
  { location_id: 'LOC-WH-GF', parent_location_id: 'LOC-WH', location_name: 'WH Ground Floor',                 location_type: 'floor', site: 'WH', floor: 'GF', block: null, zone: null, capacity: null, initial_fill_ratio: null, status: 'active' },
  { location_id: 'LOC-WH-SF', parent_location_id: 'LOC-WH', location_name: 'WH Second Floor / Ramp Landing', location_type: 'floor', site: 'WH', floor: 'SF', block: null, zone: null, capacity: null, initial_fill_ratio: null, status: 'active' },

  // KMP GF
  { location_id: 'LOC-KMP-GF-GATE',  parent_location_id: 'LOC-KMP-GF', location_name: 'KMP Main Gate',          location_type: 'dock',         site: 'KMP', floor: 'GF', block: null,      zone: 'Gate',   capacity: 'trucks',         capacity_limit: 5,  initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-KMP-GF-DOCK3', parent_location_id: 'LOC-KMP-GF', location_name: 'Dock-3 / Inward Bay',    location_type: 'dock',         site: 'KMP', floor: 'GF', block: 'A-Block', zone: 'Dock-3', capacity: 'pallets / bins', capacity_limit: 10, initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-KMP-GF-IQC',   parent_location_id: 'LOC-KMP-GF', location_name: 'KMP IQC Hold Area',      location_type: 'buffer',       site: 'KMP', floor: 'GF', block: 'A-Block', zone: 'IQC',    capacity: '10 bins',        capacity_limit: 10, initial_fill_ratio: 0.3, status: 'active' },
  { location_id: 'LOC-KMP-GF-LIFT',  parent_location_id: 'LOC-KMP-GF', location_name: 'KMP Material Lift GF',   location_type: 'lift',         site: 'KMP', floor: 'GF', block: 'A-Block', zone: 'Lift',   capacity: '5 pallets',      capacity_limit: 5,  initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-KMP-GF-VRC',   parent_location_id: 'LOC-KMP-GF', location_name: 'KMP VRC GF Point',       location_type: 'lift',         site: 'KMP', floor: 'GF', block: 'A-Block', zone: 'VRC',    capacity: 'bins only',      capacity_limit: 5,  initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-KMP-GF-SMT',   parent_location_id: 'LOC-KMP-GF', location_name: 'SMT Line Area',          location_type: 'station_zone', site: 'KMP', floor: 'GF', block: 'A-Block', zone: 'SMT',    capacity: 'ESD bins',       capacity_limit: 8,  initial_fill_ratio: 0.4, status: 'active' },
  { location_id: 'LOC-KMP-GF-FCT',   parent_location_id: 'LOC-KMP-GF', location_name: 'FCT Station Area',       location_type: 'station_zone', site: 'KMP', floor: 'GF', block: 'A-Block', zone: 'FCT',    capacity: 'ESD bins',       capacity_limit: 8,  initial_fill_ratio: 0.3, status: 'active' },

  // KMP FF
  { location_id: 'LOC-KMP-FF-LIFT',   parent_location_id: 'LOC-KMP-FF', location_name: 'KMP Material Lift FF', location_type: 'lift',  site: 'KMP', floor: 'FF', block: 'A-Block', zone: 'Lift',  capacity: '5 pallets',      capacity_limit: 5,  initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-KMP-FF-ESTORE', parent_location_id: 'LOC-KMP-FF', location_name: 'Electronic Store',     location_type: 'store', site: 'KMP', floor: 'FF', block: 'A-Block', zone: 'Store', capacity: 'ESD racks',      capacity_limit: 20, initial_fill_ratio: 0.6, status: 'active' },
  { location_id: 'LOC-KMP-FF-VRC',    parent_location_id: 'LOC-KMP-FF', location_name: 'KMP VRC FF Point',     location_type: 'lift',  site: 'KMP', floor: 'FF', block: 'A-Block', zone: 'VRC',   capacity: 'bins only',      capacity_limit: 5,  initial_fill_ratio: 0.0, status: 'active' },

  // KMP SF
  { location_id: 'LOC-KMP-SF-LIFT',     parent_location_id: 'LOC-KMP-SF', location_name: 'KMP Material Lift SF',   location_type: 'lift',         site: 'KMP', floor: 'SF', block: null,      zone: 'Lift',        capacity: '5 pallets',      capacity_limit: 5,  initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-KMP-SF-VRC',      parent_location_id: 'LOC-KMP-SF', location_name: 'KMP VRC SF Point',       location_type: 'lift',         site: 'KMP', floor: 'SF', block: 'A-Block', zone: 'VRC',         capacity: 'bins only',      capacity_limit: 5,  initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-KMP-SF-A-TRSS',   parent_location_id: 'LOC-KMP-SF', location_name: 'TRSS Assembly Area',     location_type: 'station_zone', site: 'KMP', floor: 'SF', block: 'A-Block', zone: 'TRSS',        capacity: 'ESD trays',      capacity_limit: 8,  initial_fill_ratio: 0.5, status: 'active' },
  { location_id: 'LOC-KMP-SF-B-WIP',    parent_location_id: 'LOC-KMP-SF', location_name: 'B-Block WIP Supermarket',location_type: 'buffer',       site: 'KMP', floor: 'SF', block: 'B-Block', zone: '1P WIP',      capacity: '2-bin Kanban',   capacity_limit: 10, initial_fill_ratio: 0.5, status: 'active' },
  { location_id: 'LOC-KMP-SF-B-1P',     parent_location_id: 'LOC-KMP-SF', location_name: '1P Assembly + SPM Line', location_type: 'station_zone', site: 'KMP', floor: 'SF', block: 'B-Block', zone: '1P Assembly', capacity: 'SFG bins',       capacity_limit: 8,  initial_fill_ratio: 0.3, status: 'active' },
  { location_id: 'LOC-KMP-SF-SFG-PACK', parent_location_id: 'LOC-KMP-SF', location_name: 'SFG Boxing / Palletizing',location_type: 'station_zone',site: 'KMP', floor: 'SF', block: 'B-Block', zone: 'SFG Packing',  capacity: '25 bins/pallet', capacity_limit: 8,  initial_fill_ratio: 0.2, status: 'active' },
  { location_id: 'LOC-KMP-SF-RAMP',     parent_location_id: 'LOC-KMP-SF', location_name: 'KMP SF Ramp Landing',   location_type: 'ramp',         site: 'KMP', floor: 'SF', block: null,      zone: 'Ramp',        capacity: 'pallets / bins', capacity_limit: 5,  initial_fill_ratio: 0.0, status: 'active' },

  // KMP 3F
  { location_id: 'LOC-KMP-3F-FAT', parent_location_id: 'LOC-KMP-3F', location_name: 'FAT Lab', location_type: 'inspection_area', site: 'KMP', floor: '3F', block: null, zone: 'FAT', capacity: 'samples', capacity_limit: 5, initial_fill_ratio: 0.0, status: 'active' },

  // WH SF
  { location_id: 'LOC-WH-SF-RAMP', parent_location_id: 'LOC-WH-SF', location_name: 'WH SF Ramp Landing', location_type: 'ramp', site: 'WH', floor: 'SF', block: null, zone: 'Ramp', capacity: 'pallets / bins', capacity_limit: 5, initial_fill_ratio: 0.0, status: 'active' },

  // WH GF
  { location_id: 'LOC-WH-GF-GATE',     parent_location_id: 'LOC-WH-GF',      location_name: 'WH Main Gate',             location_type: 'dock',         site: 'WH', floor: 'GF', block: null, zone: 'Gate',       capacity: 'trucks',           capacity_limit: 5,  initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-WH-GF-INWARD',   parent_location_id: 'LOC-WH-GF',      location_name: 'WH Inward / GRN Bay',      location_type: 'dock',         site: 'WH', floor: 'GF', block: null, zone: 'Inward',     capacity: 'bins / pallets',   capacity_limit: 10, initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-WH-GF-IQC',      parent_location_id: 'LOC-WH-GF',      location_name: 'WH IQC Hold Area',         location_type: 'buffer',       site: 'WH', floor: 'GF', block: null, zone: 'IQC',        capacity: '10 bins',          capacity_limit: 10, initial_fill_ratio: 0.0, status: 'active' },
  { location_id: 'LOC-WH-GF-ASRS',     parent_location_id: 'LOC-WH-GF',      location_name: 'WH ASRS',                  location_type: 'ASRS',         site: 'WH', floor: 'GF', block: null, zone: 'ASRS',       capacity: 'bins / pallets',   capacity_limit: 20, initial_fill_ratio: 0.5, status: 'active' },
  { location_id: 'LOC-WH-GF-ASRS-IN',  parent_location_id: 'LOC-WH-GF-ASRS', location_name: 'WH ASRS Input Station',    location_type: 'ASRS_point',   site: 'WH', floor: 'GF', block: null, zone: 'ASRS In',    capacity: 'pallets',          capacity_limit: 10, initial_fill_ratio: 0.2, status: 'active' },
  { location_id: 'LOC-WH-GF-ASRS-OUT', parent_location_id: 'LOC-WH-GF-ASRS', location_name: 'WH ASRS Output Station',   location_type: 'ASRS_point',   site: 'WH', floor: 'GF', block: null, zone: 'ASRS Out',   capacity: 'pallets',          capacity_limit: 10, initial_fill_ratio: 0.3, status: 'active' },
  { location_id: 'LOC-WH-GF-VC',       parent_location_id: 'LOC-WH-GF',      location_name: 'Value Creation Area',      location_type: 'station_zone', site: 'WH', floor: 'GF', block: null, zone: 'VC',         capacity: 'SFG bins',         capacity_limit: 8,  initial_fill_ratio: 0.4, status: 'active' },
  { location_id: 'LOC-WH-GF-PACK',     parent_location_id: 'LOC-WH-GF',      location_name: 'Automated Packaging Area', location_type: 'station_zone', site: 'WH', floor: 'GF', block: null, zone: 'Packaging',  capacity: 'cartons / pallets',capacity_limit: 8,  initial_fill_ratio: 0.3, status: 'active' },
  { location_id: 'LOC-WH-GF-FG-ASRS',  parent_location_id: 'LOC-WH-GF-ASRS', location_name: 'FG ASRS Zone',             location_type: 'ASRS_zone',    site: 'WH', floor: 'GF', block: null, zone: 'FG Storage', capacity: 'FG pallets',       capacity_limit: 20, initial_fill_ratio: 0.4, status: 'active' },
  { location_id: 'LOC-WH-GF-DISPATCH', parent_location_id: 'LOC-WH-GF',      location_name: 'Dispatch Staging + Dock',  location_type: 'dispatch',     site: 'WH', floor: 'GF', block: null, zone: 'Dispatch',   capacity: 'trucks / pallets', capacity_limit: 10, initial_fill_ratio: 0.2, status: 'active' },
];

// ─── 2. PATHS ─────────────────────────────────────────────────────────────────

export const path = [
  { path_id: 'PATH-SUP-KMP-GATE',      from_location_id: 'EXTERNAL-SUPPLIER',   to_location_id: 'LOC-KMP-GF-GATE',    movement_mode: 'road',              resource_hint: 'supplier truck',                  capacity: 'truckload',          distance: '1000m', travel_time: '15s', distance_val: 1000, travel_time_val: 15, status: 'active' },
  { path_id: 'PATH-KMP-GATE-DOCK3',    from_location_id: 'LOC-KMP-GF-GATE',     to_location_id: 'LOC-KMP-GF-DOCK3',   movement_mode: 'road/internal',     resource_hint: 'supplier truck',                  capacity: 'pallets/bins',       distance: '50m',   travel_time: '5s',  distance_val: 50,   travel_time_val: 5,  status: 'active' },
  { path_id: 'PATH-DOCK3-IQC',         from_location_id: 'LOC-KMP-GF-DOCK3',    to_location_id: 'LOC-KMP-GF-IQC',     movement_mode: 'manual/HPT',        resource_hint: 'HPT/manual',                      capacity: 'bins',               distance: '10m',   travel_time: '2s',  distance_val: 10,   travel_time_val: 2,  status: 'active' },
  { path_id: 'PATH-IQC-LIFT-GF',       from_location_id: 'LOC-KMP-GF-IQC',      to_location_id: 'LOC-KMP-GF-LIFT',    movement_mode: 'manual/HPT',        resource_hint: 'HPT',                             capacity: 'pallet',             distance: '8m',    travel_time: '2s',  distance_val: 8,    travel_time_val: 2,  status: 'active' },
  { path_id: 'PATH-LIFT-GF-FF',        from_location_id: 'LOC-KMP-GF-LIFT',     to_location_id: 'LOC-KMP-FF-LIFT',    movement_mode: 'lift',              resource_hint: 'material lift',                   capacity: 'pallet',             distance: '5m',    travel_time: '3s',  distance_val: 5,    travel_time_val: 3,  status: 'active' },
  { path_id: 'PATH-LIFT-FF-ESTORE',    from_location_id: 'LOC-KMP-FF-LIFT',     to_location_id: 'LOC-KMP-FF-ESTORE',  movement_mode: 'stacker/HPT',       resource_hint: 'stacker/HPT',                     capacity: 'pallet',             distance: '10m',   travel_time: '2s',  distance_val: 10,   travel_time_val: 2,  status: 'active' },
  { path_id: 'PATH-ESTORE-VRC-FF',     from_location_id: 'LOC-KMP-FF-ESTORE',   to_location_id: 'LOC-KMP-FF-VRC',     movement_mode: 'trolley',           resource_hint: 'operator/trolley',                capacity: 'ESD bins',           distance: '12m',   travel_time: '3s',  distance_val: 12,   travel_time_val: 3,  status: 'active' },
  { path_id: 'PATH-VRC-FF-GF',         from_location_id: 'LOC-KMP-FF-VRC',      to_location_id: 'LOC-KMP-GF-VRC',     movement_mode: 'VRC',               resource_hint: 'VRC',                             capacity: 'bins only',          distance: '5m',    travel_time: '3s',  distance_val: 5,    travel_time_val: 3,  status: 'active' },
  { path_id: 'PATH-VRC-GF-SMT',        from_location_id: 'LOC-KMP-GF-VRC',      to_location_id: 'LOC-KMP-GF-SMT',     movement_mode: 'trolley',           resource_hint: 'operator/trolley',                capacity: 'ESD bins',           distance: '10m',   travel_time: '2s',  distance_val: 10,   travel_time_val: 2,  status: 'active' },
  { path_id: 'PATH-SMT-FCT',           from_location_id: 'LOC-KMP-GF-SMT',      to_location_id: 'LOC-KMP-GF-FCT',     movement_mode: 'trolley/manual',    resource_hint: 'bin trolley',                     capacity: 'ESD bins',           distance: '5m',    travel_time: '1s',  distance_val: 5,    travel_time_val: 1,  status: 'active' },
  { path_id: 'PATH-FCT-VRC-GF',        from_location_id: 'LOC-KMP-GF-FCT',      to_location_id: 'LOC-KMP-GF-VRC',     movement_mode: 'trolley',           resource_hint: 'bin trolley',                     capacity: 'ESD bins',           distance: '10m',   travel_time: '2s',  distance_val: 10,   travel_time_val: 2,  status: 'active' },
  { path_id: 'PATH-VRC-GF-SF',         from_location_id: 'LOC-KMP-GF-VRC',      to_location_id: 'LOC-KMP-SF-VRC',     movement_mode: 'VRC',               resource_hint: 'VRC',                             capacity: 'bins only',          distance: '10m',   travel_time: '6s',  distance_val: 10,   travel_time_val: 6,  status: 'active' },
  { path_id: 'PATH-VRC-SF-TRSS',       from_location_id: 'LOC-KMP-SF-VRC',      to_location_id: 'LOC-KMP-SF-A-TRSS',  movement_mode: 'trolley',           resource_hint: 'operator/trolley',                capacity: 'ESD bins',           distance: '15m',   travel_time: '3s',  distance_val: 15,   travel_time_val: 3,  status: 'active' },
  { path_id: 'PATH-WH-ASRS-KMP-SF',    from_location_id: 'LOC-WH-GF-ASRS-OUT',  to_location_id: 'LOC-KMP-SF-B-WIP',   movement_mode: 'ASRS+ramp+stacker', resource_hint: 'ASRS crane + stacker',            capacity: 'pallets/bins',       distance: '80m',   travel_time: '15s', distance_val: 80,   travel_time_val: 15, status: 'active' },
  { path_id: 'PATH-TRSS-BWIP',         from_location_id: 'LOC-KMP-SF-A-TRSS',   to_location_id: 'LOC-KMP-SF-B-WIP',   movement_mode: 'trolley',           resource_hint: 'bin trolley',                     capacity: 'ESD trays',          distance: '12m',   travel_time: '3s',  distance_val: 12,   travel_time_val: 3,  status: 'active' },
  { path_id: 'PATH-BWIP-1P',           from_location_id: 'LOC-KMP-SF-B-WIP',    to_location_id: 'LOC-KMP-SF-B-1P',    movement_mode: 'line_feed',         resource_hint: 'operator/line feeder',            capacity: 'station bins',       distance: '5m',    travel_time: '1s',  distance_val: 5,    travel_time_val: 1,  status: 'active' },
  { path_id: 'PATH-1P-SFG-PACK',       from_location_id: 'LOC-KMP-SF-B-1P',     to_location_id: 'LOC-KMP-SF-SFG-PACK',movement_mode: 'in_station',        resource_hint: 'operator/MES scan',               capacity: 'SFG bins',           distance: '2m',    travel_time: '1s',  distance_val: 2,    travel_time_val: 1,  status: 'active' },
  { path_id: 'PATH-KMP-SFG-WH-ASRS',   from_location_id: 'LOC-KMP-SF-SFG-PACK', to_location_id: 'LOC-WH-GF-ASRS-IN',  movement_mode: 'ramp+stacker+ASRS', resource_hint: 'stacker + ASRS crane',            capacity: 'SFG pallet',         distance: '90m',   travel_time: '18s', distance_val: 90,   travel_time_val: 18, status: 'active' },
  { path_id: 'PATH-WH-ASRS-VC',        from_location_id: 'LOC-WH-GF-ASRS-OUT',  to_location_id: 'LOC-WH-GF-VC',       movement_mode: 'stacker/AMR',       resource_hint: 'electric stacker/AMR',            capacity: 'SFG pallet',         distance: '15m',   travel_time: '3s',  distance_val: 15,   travel_time_val: 3,  status: 'active' },
  { path_id: 'PATH-VC-PACK',           from_location_id: 'LOC-WH-GF-VC',        to_location_id: 'LOC-WH-GF-PACK',     movement_mode: 'HPT/AMR/manual',    resource_hint: 'HPT/AMR/manual',                  capacity: 'SFG bin/pallet',     distance: '20m',   travel_time: '4s',  distance_val: 20,   travel_time_val: 4,  status: 'active' },
  { path_id: 'PATH-PACK-FG-ASRS',      from_location_id: 'LOC-WH-GF-PACK',      to_location_id: 'LOC-WH-GF-FG-ASRS',  movement_mode: 'stacker+ASRS',      resource_hint: 'electric stacker + ASRS crane',   capacity: 'FG pallet',          distance: '18m',   travel_time: '4s',  distance_val: 18,   travel_time_val: 4,  status: 'active' },
  { path_id: 'PATH-FG-ASRS-FAT',       from_location_id: 'LOC-WH-GF-FG-ASRS',   to_location_id: 'LOC-KMP-3F-FAT',     movement_mode: 'manual/trolley',    resource_hint: 'manual/trolley',                  capacity: 'samples',            distance: '70m',   travel_time: '14s', distance_val: 70,   travel_time_val: 14, status: 'active' },
  { path_id: 'PATH-FG-ASRS-DISPATCH',  from_location_id: 'LOC-WH-GF-FG-ASRS',   to_location_id: 'LOC-WH-GF-DISPATCH', movement_mode: 'ASRS+stacker',      resource_hint: 'ASRS crane + electric stacker',   capacity: 'FG pallet',          distance: '15m',   travel_time: '3s',  distance_val: 15,   travel_time_val: 3,  status: 'active' },
  { path_id: 'PATH-DISPATCH-CUSTOMER', from_location_id: 'LOC-WH-GF-DISPATCH',   to_location_id: 'LOC-CUSTOMER',       movement_mode: 'road',              resource_hint: 'covered truck',                   capacity: 'truckload',          distance: '2000m', travel_time: '30s', distance_val: 2000, travel_time_val: 30, status: 'active' },
  { path_id: 'PATH-KMP-EMPTYBIN-DOCK3',from_location_id: 'LOC-KMP-SF-B-WIP',     to_location_id: 'LOC-KMP-GF-DOCK3',   movement_mode: 'lift+trolley',      resource_hint: 'material lift + trolley',         capacity: 'empty bins',         distance: '40m',   travel_time: '10s', distance_val: 40,   travel_time_val: 10, status: 'active' },
  { path_id: 'PATH-WH-VC-EMPTYBIN-KMP',from_location_id: 'LOC-WH-GF-VC',         to_location_id: 'LOC-KMP-GF-DOCK3',   movement_mode: 'lift+ramp+trolley', resource_hint: 'WH lift + KMP trolley',           capacity: 'empty bins',         distance: '85m',   travel_time: '16s', distance_val: 85,   travel_time_val: 16, status: 'active' },
];

// ─── 3. OPERATING ASSETS ──────────────────────────────────────────────────────

export const station = [
  { station_id: 'ST-KMP-GRN-01',      station_group: 'GRN',               location_id: 'LOC-KMP-GF-DOCK3',    station_type: 'manual + HHT',            process_area: 'inbound',      capacity: '10 bins',                                instance_count: 1, operator_count: '1',            status: 'active' },
  { station_id: 'ST-KMP-IQC-01',      station_group: 'IQC',               location_id: 'LOC-KMP-GF-IQC',      station_type: 'inspection',              process_area: 'inbound QA',   capacity: '5 bins',                                 instance_count: 1, operator_count: 'QA engineer', status: 'active' },
  { station_id: 'ST-KMP-SMT-01',      station_group: 'SMT_LINE',          location_id: 'LOC-KMP-GF-SMT',      station_type: 'automated line',          process_area: 'SMT',          capacity: '40 PCBAs/bin; 1280/pallet',              instance_count: 1, operator_count: '2',            status: 'active' },
  { station_id: 'ST-KMP-AOI-01',      station_group: 'AOI',               location_id: 'LOC-KMP-GF-SMT',      station_type: 'automated inspection',    process_area: 'SMT',          capacity: '100% PCBA',                              instance_count: 1, operator_count: '0',            status: 'active' },
  { station_id: 'ST-KMP-FCT-01',      station_group: 'FCT',               location_id: 'LOC-KMP-GF-FCT',      station_type: 'bench test',              process_area: 'PCBA test',    capacity: '100% PCBA',                              instance_count: 1, operator_count: '1',            status: 'active' },
  { station_id: 'ST-KMP-TRSS-01',     station_group: 'TRSS_ASSEMBLY',     location_id: 'LOC-KMP-SF-A-TRSS',   station_type: 'manual assembly',         process_area: 'TRSS',         capacity: 'cycle 20.5 sec/TRSS',                    instance_count: 1, operator_count: '1',            status: 'active' },
  { station_id: 'ST-KMP-SPM-01',      station_group: 'SPM_LINE',          location_id: 'LOC-KMP-SF-B-1P',     station_type: 'automated test/assembly', process_area: '1P assembly', capacity: 'P1 16.6s; SPM 20s; seal 13s; MES QC 19s', instance_count: 1, operator_count: '2',            status: 'active' },
  { station_id: 'ST-KMP-SFG-PACK-01', station_group: 'SFG_PACKING',       location_id: 'LOC-KMP-SF-SFG-PACK', station_type: 'manual packing',            process_area: 'SFG Packing',  capacity: '10 meters/bin; 250/pallet',              instance_count: 1, operator_count: 'PQA + worker', status: 'active' },
  { station_id: 'ST-WH-GRN-01',       station_group: 'WH_GRN',            location_id: 'LOC-WH-GF-INWARD',    station_type: 'manual + HHT',            process_area: 'WH inbound',   capacity: '10 bins',                                instance_count: 1, operator_count: '1',            status: 'active' },
  { station_id: 'ST-WH-IQC-01',       station_group: 'WH_IQC',            location_id: 'LOC-WH-GF-IQC',      station_type: 'inspection',              process_area: 'WH inbound QA',capacity: '5 bins',                                 instance_count: 1, operator_count: 'QA',           status: 'active' },
  { station_id: 'ST-WH-ASRS-01',      station_group: 'ASRS',              location_id: 'LOC-WH-GF-ASRS',      station_type: 'automated storage',       process_area: 'WH storage',   capacity: 'pallets/bins',                           instance_count: 1, operator_count: '0 direct',     status: 'active' },
  { station_id: 'ST-WH-VC-01',        station_group: 'VALUE_CREATION',    location_id: 'LOC-WH-GF-VC',        station_type: 'manual/semi-auto',        process_area: 'NIC+SIM+seal', capacity: '22.5 sec/meter',                         instance_count: 1, operator_count: '1',            status: 'active' },
  { station_id: 'ST-WH-SCREEN-01',    station_group: 'SCREEN_LASER_HOLO', location_id: 'LOC-WH-GF-PACK',      station_type: 'automated line',          process_area: 'Packaging',    capacity: '10 sec each stage',                      instance_count: 1, operator_count: '0',            status: 'active' },
  { station_id: 'ST-WH-AUTOPACK-01',   station_group: 'AUTO_PACK',         location_id: 'LOC-WH-GF-PACK',      station_type: 'automated packaging',     process_area: 'Packaging',    capacity: 'carton 19 sec/meter',                    instance_count: 1, operator_count: '1',            status: 'active' },
  { station_id: 'ST-KMP-FAT-01',      station_group: 'FAT',               location_id: 'LOC-KMP-3F-FAT',      station_type: 'inspection/test',         process_area: 'PDI/FAT',      capacity: 'Sample rule: n=5 functional, n=32 visual',instance_count: 1, operator_count: 'QA',           status: 'active' },
  { station_id: 'ST-WH-DISPATCH-01',  station_group: 'DISPATCH',          location_id: 'LOC-WH-GF-DISPATCH',  station_type: 'staging/loading',         process_area: 'dispatch',     capacity: 'truckload',                              instance_count: 1, operator_count: 'logistics',    status: 'active' }
];

export const resource = [
  { resource_id: 'RES-SUP-TRUCK',       resource_type: 'supplier_truck',  home_location_id: 'EXTERNAL-SUPPLIER',   used_for: 'supplier inbound',              capacity: 'truckload',          status: 'active' },
  { resource_id: 'RES-MAT-LIFT-KMP',    resource_type: 'material_lift',   home_location_id: 'LOC-KMP-GF-LIFT',     used_for: 'GF/FF/SF vertical movement',    capacity: 'pallet/bin',         status: 'active' },
  { resource_id: 'RES-VRC-KMP',         resource_type: 'VRC',             home_location_id: 'LOC-KMP-GF-VRC',     used_for: 'FF/GF/SF bin movement',         capacity: 'bins only',          status: 'active' },
  { resource_id: 'RES-ELEC-STACKER-WH',  resource_type: 'electric_stacker',home_location_id: 'LOC-WH-GF',           used_for: 'WH ASRS, VC, dispatch moves',   capacity: 'pallet',             status: 'active' },
  { resource_id: 'RES-ELEC-STACKER-KMP', resource_type: 'electric_stacker',home_location_id: 'LOC-KMP-SF',           used_for: 'KMP SF movements',              capacity: 'pallet/bin',         status: 'active' },
  { resource_id: 'RES-HPT',             resource_type: 'HPT',              home_location_id: 'shared',              used_for: 'short internal moves',          capacity: 'pallet/bin',         status: 'active' },
  { resource_id: 'RES-ASRS-CRANE',      resource_type: 'ASRS_crane',      home_location_id: 'LOC-WH-GF-ASRS',      used_for: 'ASRS putaway/retrieval',        capacity: 'pallet/bin',         status: 'active' },
  { resource_id: 'RES-BIN-TROLLEY',     resource_type: 'bin_trolley',     home_location_id: 'shared',              used_for: 'ESD/tray/bin moves',            capacity: 'bins/trays',         status: 'active' },
  { resource_id: 'RES-FORKLIFT',        resource_type: 'forklift',        home_location_id: 'LOC-WH-GF-DISPATCH',  used_for: 'truck loading',                 capacity: 'pallets',            status: 'active' },
  { resource_id: 'RES-AMR-PLACEHOLDER', resource_type: 'AMR',             home_location_id: 'LOC-WH-GF-VC',        used_for: 'future automated movement',     capacity: '1 bin',              status: 'planned' },
  { resource_id: 'RES-OPERATOR',        resource_type: 'operator',        home_location_id: 'shared',              used_for: 'manual assembly/movement',      capacity: 'human',              status: 'active' },
  { resource_id: 'RES-QA',              resource_type: 'QA_engineer',     home_location_id: 'shared',              used_for: 'IQC/PQA/FAT checks',            capacity: 'inspection',         status: 'active' }
];

// ─── 4. PROCESS LOGIC ────────────────────────────────────────────────────────

export const process = [
  { process_id: 'PROC-KMP-INBOUND',          process_name: 'Electronic Components Arrival',      process_type: 'receive',   input_state: 'RM_SUPPLIER',                             output_state_pass: 'RM_RECEIVED_KMP', output_state_fail: 'DOC_HOLD',             cycle_time: '10m',  cycle_time_s: 600,  status: 'active' },
  { process_id: 'PROC-KMP-GRN-IQC',          process_name: 'KMP GRN + IQC',                      process_type: 'inspect',   input_state: 'RM_RECEIVED_KMP',                         output_state_pass: 'RM_IQC_PASS',     output_state_fail: 'RM_IQC_HOLD / NG_HOLD', cycle_time: '15m',  cycle_time_s: 900,  status: 'active' },
  { process_id: 'PROC-KMP-ESTORE-PUTAWAY',   process_name: 'Electronic Store Putaway',           process_type: 'hold',      input_state: 'RM_IQC_PASS',                             output_state_pass: 'RM_ESTORE_STOCK', output_state_fail: null,                 cycle_time: '5m',   cycle_time_s: 300,  status: 'active' },
  { process_id: 'PROC-KMP-SMT-ISSUE',        process_name: 'Issue Electronics to SMT',           process_type: 'release',   input_state: 'RM_ESTORE_STOCK',                         output_state_pass: 'SMT_LINE_WIP',    output_state_fail: 'SHORTAGE_HOLD',        cycle_time: '2m',   cycle_time_s: 120,  status: 'active' },
  { process_id: 'PROC-KMP-SMT',              process_name: 'SMT + Wave + AOI',                   process_type: 'transform', input_state: 'SMT_LINE_WIP',                            output_state_pass: 'PCBA_WIP',        output_state_fail: 'NG_HOLD',              cycle_time: '1m',   cycle_time_s: 60,   status: 'active' },
  { process_id: 'PROC-KMP-FCT',              process_name: 'Intelligent FCT',                    process_type: 'inspect',   input_state: 'PCBA_WIP',                                output_state_pass: 'PCBA_FCT_PASS',   output_state_fail: 'NG_HOLD',              cycle_time: '10s',  cycle_time_s: 10,   status: 'active' },
  { process_id: 'PROC-KMP-TRSS-MATL-RECEIPT', process_name: 'TRSS Child Part Receipt',            process_type: 'receive',   input_state: 'RM_IQC_PASS',                             output_state_pass: 'TRSS_CHILD_WIP',  output_state_fail: 'MISMATCH_HOLD',        cycle_time: '5m',   cycle_time_s: 300,  status: 'active' },
  { process_id: 'PROC-KMP-TRSS-ASSEMBLY',    process_name: 'TRSS Sub-Assembly',                  process_type: 'assemble',  input_state: 'TRSS_CHILD_WIP',                          output_state_pass: 'TRSS_READY',      output_state_fail: 'NG_HOLD',              cycle_time: '20.5s', cycle_time_s: 20.5, status: 'active' },
  { process_id: 'PROC-KMP-BOP-RECEIPT',      process_name: 'Plastic/BOP Receipt from WH ASRS',   process_type: 'receive',   input_state: 'RM_IQC_PASS',                             output_state_pass: 'BOP_LINE_WIP',    output_state_fail: 'MISMATCH_HOLD',        cycle_time: '5m',   cycle_time_s: 300,  status: 'active' },
  { process_id: 'PROC-KMP-1P-MATL-ISSUE',    process_name: 'Issue Material to 1P Line',          process_type: 'release',   input_state: 'BOP_LINE_WIP+TRSS_READY+PCBA_FCT_PASS',   output_state_pass: 'LINE_WIP',        output_state_fail: 'SHORTAGE_HOLD',        cycle_time: '2m',   cycle_time_s: 120,  status: 'active' },
  { process_id: 'PROC-KMP-1P-SPM',           process_name: '1P Assembly + SPM + MES QC',         process_type: 'assemble',  input_state: 'LINE_WIP',                                output_state_pass: 'SFG_METER',       output_state_fail: 'NG_HOLD',              cycle_time: '16.6s', cycle_time_s: 16.6, status: 'active' },
  { process_id: 'PROC-KMP-SFG-BOX',          process_name: 'WIP Boxing into SFG Bins',           process_type: 'pack',      input_state: 'SFG_METER',                               output_state_pass: 'SFG_BINNED',      output_state_fail: 'NG_HOLD',              cycle_time: '5s',   cycle_time_s: 5,    status: 'active' },
  { process_id: 'PROC-KMP-SFG-PALLET',       process_name: 'SFG Palletizing',                    process_type: 'pack',      input_state: 'SFG_BINNED',                              output_state_pass: 'SFG_PALLETIZED',  output_state_fail: null,                 cycle_time: '10s',  cycle_time_s: 10,   status: 'active' },
  { process_id: 'PROC-WH-SFG-ASRS-PUTAWAY',  process_name: 'SFG Putaway in WH ASRS',             process_type: 'hold',      input_state: 'SFG_PALLETIZED',                          output_state_pass: 'SFG_WH_HOLD',     output_state_fail: 'LOCATION_HOLD',        cycle_time: '3m',   cycle_time_s: 180,  status: 'active' },
  { process_id: 'PROC-WH-SFG-RETRIEVE-VC',   process_name: 'SFG Retrieve to VC',                 process_type: 'release',   input_state: 'SFG_WH_HOLD',                             output_state_pass: 'SFG_AT_VC',        output_state_fail: null,                 cycle_time: '2m',   cycle_time_s: 120,  status: 'active' },
  { process_id: 'PROC-WH-NIC-SIM-SEAL',      process_name: 'NIC + SIM + Seal Assembly',          process_type: 'assemble',  input_state: 'SFG_AT_VC',                               output_state_pass: 'VC_METER',        output_state_fail: 'NG_HOLD',              cycle_time: '22.5s', cycle_time_s: 22.5, status: 'active' },
  { process_id: 'PROC-WH-VC-TO-PACK',        process_name: 'VC Output to Packaging',             process_type: 'release',   input_state: 'VC_METER',                               output_state_pass: 'VC_METER_PACK_WIP',output_state_fail: 'ORDER_HOLD',           cycle_time: '2m',   cycle_time_s: 120,  status: 'active' },
  { process_id: 'PROC-WH-SCREEN-LASER-HOLO', process_name: 'Screening + Laser + Hologram',      process_type: 'inspect',   input_state: 'VC_METER_PACK_WIP',                       output_state_pass: 'POST_SCREEN_METER',output_state_fail: 'NG_HOLD',              cycle_time: '30s',  cycle_time_s: 30,   status: 'active' },
  { process_id: 'PROC-WH-AUTO-PACK',         process_name: 'Automated Final Packaging',          process_type: 'pack',      input_state: 'POST_SCREEN_METER',                       output_state_pass: 'PACKED_FG',       output_state_fail: 'NG_HOLD',              cycle_time: '19s',  cycle_time_s: 19,   status: 'active' },
  { process_id: 'PROC-WH-FG-ASRS-PUTAWAY',   process_name: 'FG ASRS Putaway',                    process_type: 'hold',      input_state: 'PACKED_FG',                               output_state_pass: 'FG_QA_HOLD',      output_state_fail: 'LOCATION_HOLD',        cycle_time: '3m',   cycle_time_s: 180,  status: 'active' },
  { process_id: 'PROC-KMP-PDI-FAT',          process_name: 'PDI + FAT',                          process_type: 'inspect',   input_state: 'FG_QA_HOLD',                              output_state_pass: 'FG_RELEASED',     output_state_fail: 'FG_QA_HOLD / NG_HOLD', cycle_time: '10m',  cycle_time_s: 600,  status: 'active' },
  { process_id: 'PROC-WH-DISPATCH-STAGE',    process_name: 'FG Retrieval to Dispatch Staging',   process_type: 'release',   input_state: 'FG_RELEASED',                             output_state_pass: 'DISPATCH_STAGED', output_state_fail: 'RELEASE_HOLD',        cycle_time: '2m',   cycle_time_s: 120,  status: 'active' },
  { process_id: 'PROC-WH-DISPATCH',          process_name: 'Truck Loading + Dispatch',           process_type: 'release',   input_state: 'DISPATCH_STAGED',                         output_state_pass: 'DISPATCHED',      output_state_fail: 'DOC_HOLD',             cycle_time: '15m',  cycle_time_s: 900,  status: 'active' },
  { process_id: 'PROC-KMP-EMPTYBIN-RETURN',  process_name: 'KMP Empty Leap Bin Return',          process_type: 'return',    input_state: 'EMPTY_BIN',                               output_state_pass: 'EMPTY_BIN_DOCK3', output_state_fail: 'DAMAGED_BIN_HOLD',     cycle_time: '5m',   cycle_time_s: 300,  status: 'active' },
  { process_id: 'PROC-WH-EMPTYBIN-RETURN',   process_name: 'WH VC Empty Bin Return to KMP',      process_type: 'return',    input_state: 'EMPTY_BIN',                               output_state_pass: 'EMPTY_BIN_DOCK3', output_state_fail: 'DAMAGED_BIN_HOLD',     cycle_time: '8m',   cycle_time_s: 480,  status: 'active' }
];

// Main production route: 24 steps from Supplier to Customer
export const route_step = [
  { route_id: 'ROUTE-M800-MAIN', seq: 10,  sequence_no: 10,  from_location_id: 'EXTERNAL-SUPPLIER',   path_id: 'PATH-SUP-KMP-GATE',     to_location_id: 'LOC-KMP-GF-GATE',    process_id: 'PROC-KMP-INBOUND',          input_state: 'RM_SUPPLIER',       output_state: 'RM_RECEIVED_KMP' },
  { route_id: 'ROUTE-M800-MAIN', seq: 20,  sequence_no: 20,  from_location_id: 'LOC-KMP-GF-GATE',     path_id: 'PATH-KMP-GATE-DOCK3',   to_location_id: 'LOC-KMP-GF-DOCK3',   process_id: 'PROC-KMP-INBOUND',          input_state: 'RM_RECEIVED_KMP',   output_state: 'RM_DOCKED' },
  { route_id: 'ROUTE-M800-MAIN', seq: 30,  sequence_no: 30,  from_location_id: 'LOC-KMP-GF-DOCK3',    path_id: 'PATH-DOCK3-IQC',        to_location_id: 'LOC-KMP-GF-IQC',     process_id: 'PROC-KMP-GRN-IQC',         input_state: 'RM_DOCKED',         output_state: 'RM_IQC_PASS' },
  { route_id: 'ROUTE-M800-MAIN', seq: 40,  sequence_no: 40,  from_location_id: 'LOC-KMP-GF-IQC',      path_id: 'PATH-IQC-LIFT-GF',      to_location_id: 'LOC-KMP-GF-LIFT',    process_id: 'PROC-KMP-ESTORE-PUTAWAY',  input_state: 'RM_IQC_PASS',       output_state: 'RM_IN_TRANSFER' },
  { route_id: 'ROUTE-M800-MAIN', seq: 50,  sequence_no: 50,  from_location_id: 'LOC-KMP-GF-LIFT',     path_id: 'PATH-LIFT-GF-FF',       to_location_id: 'LOC-KMP-FF-LIFT',    process_id: 'PROC-KMP-ESTORE-PUTAWAY',  input_state: 'RM_IN_TRANSFER',    output_state: 'RM_IN_TRANSFER' },
  { route_id: 'ROUTE-M800-MAIN', seq: 60,  sequence_no: 60,  from_location_id: 'LOC-KMP-FF-LIFT',     path_id: 'PATH-LIFT-FF-ESTORE',   to_location_id: 'LOC-KMP-FF-ESTORE',  process_id: 'PROC-KMP-ESTORE-PUTAWAY',  input_state: 'RM_IN_TRANSFER',    output_state: 'RM_ESTORE_STOCK' },
  { route_id: 'ROUTE-M800-MAIN', seq: 70,  sequence_no: 70,  from_location_id: 'LOC-KMP-FF-ESTORE',   path_id: 'PATH-ESTORE-VRC-FF',    to_location_id: 'LOC-KMP-FF-VRC',     process_id: 'PROC-KMP-SMT-ISSUE',       input_state: 'RM_ESTORE_STOCK',   output_state: 'SMT_LINE_WIP' },
  { route_id: 'ROUTE-M800-MAIN', seq: 80,  sequence_no: 80,  from_location_id: 'LOC-KMP-FF-VRC',      path_id: 'PATH-VRC-FF-GF',        to_location_id: 'LOC-KMP-GF-VRC',     process_id: 'PROC-KMP-SMT-ISSUE',       input_state: 'SMT_LINE_WIP',      output_state: 'SMT_LINE_WIP' },
  { route_id: 'ROUTE-M800-MAIN', seq: 90,  sequence_no: 90,  from_location_id: 'LOC-KMP-GF-VRC',      path_id: 'PATH-VRC-GF-SMT',       to_location_id: 'LOC-KMP-GF-SMT',     process_id: 'PROC-KMP-SMT',             input_state: 'SMT_LINE_WIP',      output_state: 'PCBA_WIP' },
  { route_id: 'ROUTE-M800-MAIN', seq: 100, sequence_no: 100, from_location_id: 'LOC-KMP-GF-SMT',      path_id: 'PATH-SMT-FCT',          to_location_id: 'LOC-KMP-GF-FCT',     process_id: 'PROC-KMP-FCT',             input_state: 'PCBA_WIP',          output_state: 'PCBA_FCT_PASS' },
  { route_id: 'ROUTE-M800-MAIN', seq: 110, sequence_no: 110, from_location_id: 'LOC-KMP-GF-FCT',      path_id: 'PATH-FCT-VRC-GF',       to_location_id: 'LOC-KMP-GF-VRC',     process_id: 'PROC-KMP-FCT',             input_state: 'PCBA_FCT_PASS',     output_state: 'PCBA_FCT_PASS' },
  { route_id: 'ROUTE-M800-MAIN', seq: 120, sequence_no: 120, from_location_id: 'LOC-KMP-GF-VRC',      path_id: 'PATH-VRC-GF-SF',        to_location_id: 'LOC-KMP-SF-VRC',     process_id: 'PROC-KMP-1P-MATL-ISSUE',  input_state: 'PCBA_FCT_PASS',     output_state: 'LINE_WIP' },
  { route_id: 'ROUTE-M800-MAIN', seq: 130, sequence_no: 130, from_location_id: 'LOC-KMP-SF-VRC',      path_id: 'PATH-VRC-SF-TRSS',      to_location_id: 'LOC-KMP-SF-A-TRSS',  process_id: 'PROC-KMP-TRSS-ASSEMBLY',   input_state: 'TRSS_CHILD_WIP',    output_state: 'TRSS_READY' },
  { route_id: 'ROUTE-M800-MAIN', seq: 140, sequence_no: 140, from_location_id: 'LOC-WH-GF-ASRS-OUT',  path_id: 'PATH-WH-ASRS-KMP-SF',   to_location_id: 'LOC-KMP-SF-B-WIP',   process_id: 'PROC-KMP-BOP-RECEIPT',     input_state: 'RM_IQC_PASS',       output_state: 'BOP_LINE_WIP' },
  { route_id: 'ROUTE-M800-MAIN', seq: 150, sequence_no: 150, from_location_id: 'LOC-KMP-SF-B-WIP',    path_id: 'PATH-BWIP-1P',          to_location_id: 'LOC-KMP-SF-B-1P',    process_id: 'PROC-KMP-1P-SPM',          input_state: 'LINE_WIP',          output_state: 'SFG_METER' },
  { route_id: 'ROUTE-M800-MAIN', seq: 160, sequence_no: 160, from_location_id: 'LOC-KMP-SF-B-1P',     path_id: 'PATH-1P-SFG-PACK',      to_location_id: 'LOC-KMP-SF-SFG-PACK',process_id: 'PROC-KMP-SFG-BOX',         input_state: 'SFG_METER',         output_state: 'SFG_BINNED' },
  { route_id: 'ROUTE-M800-MAIN', seq: 170, sequence_no: 170, from_location_id: 'LOC-KMP-SF-SFG-PACK', path_id: 'PATH-KMP-SFG-WH-ASRS',  to_location_id: 'LOC-WH-GF-ASRS-IN',  process_id: 'PROC-WH-SFG-ASRS-PUTAWAY',input_state: 'SFG_PALLETIZED',    output_state: 'SFG_WH_HOLD' },
  { route_id: 'ROUTE-M800-MAIN', seq: 180, sequence_no: 180, from_location_id: 'LOC-WH-GF-ASRS-OUT',  path_id: 'PATH-WH-ASRS-VC',       to_location_id: 'LOC-WH-GF-VC',       process_id: 'PROC-WH-NIC-SIM-SEAL',     input_state: 'SFG_WH_HOLD',       output_state: 'VC_METER' },
  { route_id: 'ROUTE-M800-MAIN', seq: 190, sequence_no: 190, from_location_id: 'LOC-WH-GF-VC',        path_id: 'PATH-VC-PACK',          to_location_id: 'LOC-WH-GF-PACK',     process_id: 'PROC-WH-SCREEN-LASER-HOLO',input_state: 'VC_METER',          output_state: 'POST_SCREEN_METER' },
  { route_id: 'ROUTE-M800-MAIN', seq: 200, sequence_no: 200, from_location_id: 'LOC-WH-GF-PACK',      path_id: 'PATH-VC-PACK',          to_location_id: 'LOC-WH-GF-PACK',     process_id: 'PROC-WH-AUTO-PACK',        input_state: 'POST_SCREEN_METER', output_state: 'PACKED_FG' },
  { route_id: 'ROUTE-M800-MAIN', seq: 210, sequence_no: 210, from_location_id: 'LOC-WH-GF-PACK',      path_id: 'PATH-PACK-FG-ASRS',     to_location_id: 'LOC-WH-GF-FG-ASRS',  process_id: 'PROC-WH-FG-ASRS-PUTAWAY',  input_state: 'PACKED_FG',         output_state: 'FG_QA_HOLD' },
  { route_id: 'ROUTE-M800-MAIN', seq: 220, sequence_no: 220, from_location_id: 'LOC-WH-GF-FG-ASRS',   path_id: 'PATH-FG-ASRS-FAT',      to_location_id: 'LOC-KMP-3F-FAT',     process_id: 'PROC-KMP-PDI-FAT',         input_state: 'FG_QA_HOLD',        output_state: 'FG_RELEASED' },
  { route_id: 'ROUTE-M800-MAIN', seq: 230, sequence_no: 230, from_location_id: 'LOC-WH-GF-FG-ASRS',   path_id: 'PATH-FG-ASRS-DISPATCH', to_location_id: 'LOC-WH-GF-DISPATCH', process_id: 'PROC-WH-DISPATCH-STAGE',   input_state: 'FG_RELEASED',       output_state: 'DISPATCH_STAGED' },
  { route_id: 'ROUTE-M800-MAIN', seq: 240, sequence_no: 240, from_location_id: 'LOC-WH-GF-DISPATCH',   path_id: 'PATH-DISPATCH-CUSTOMER',to_location_id: 'LOC-CUSTOMER',        process_id: 'PROC-WH-DISPATCH',         input_state: 'DISPATCH_STAGED',   output_state: 'DISPATCHED' },

  // Empty bin return routes
  { route_id: 'ROUTE-M800-EMPTY-KMP', seq: 10, sequence_no: 10, from_location_id: 'LOC-KMP-SF-B-WIP', path_id: 'PATH-KMP-EMPTYBIN-DOCK3', to_location_id: 'LOC-KMP-GF-DOCK3', process_id: 'PROC-KMP-EMPTYBIN-RETURN', input_state: 'EMPTY_BIN', output_state: 'EMPTY_BIN_DOCK3' },
  { route_id: 'ROUTE-M800-EMPTY-WH',  seq: 10, sequence_no: 10, from_location_id: 'LOC-WH-GF-VC',     path_id: 'PATH-WH-VC-EMPTYBIN-KMP',to_location_id: 'LOC-KMP-GF-DOCK3',  process_id: 'PROC-WH-EMPTYBIN-RETURN',  input_state: 'EMPTY_BIN', output_state: 'EMPTY_BIN_DOCK3' },
];

// ─── 5. MATERIAL MODEL ────────────────────────────────────────────────────────

export const material = [
  { material_id: 'MAT-BARE-PCB',          material_name: 'Bare PCB',                  material_type: 'raw_material',      traceability_level: 'lot',        source_usage: 'SMT input',                 status: 'active' },
  { material_id: 'MAT-SMD-THT',           material_name: 'SMD + THT Components',      material_type: 'raw_material',      traceability_level: 'lot',        source_usage: 'SMT input',                 status: 'active' },
  { material_id: 'MAT-SOLDER-FLUX',       material_name: 'Solder Paste + Flux',       material_type: 'consumable',        traceability_level: 'batch',      source_usage: 'SMT input',                 status: 'active' },
  { material_id: 'MAT-NIC-PCBA',          material_name: 'NIC PCBA',                  material_type: 'child_part',        traceability_level: 'serial/lot', source_usage: 'WH VC input',               status: 'active' },
  { material_id: 'MAT-QR-LABEL',          material_name: 'QR Label',                  material_type: 'consumable',        traceability_level: 'lot',        source_usage: 'PCBA/MES link',             status: 'active' },
  { material_id: 'MAT-PCBA',              material_name: 'Assembled Meter PCBA',      material_type: 'subassembly',       traceability_level: 'serial',     source_usage: 'FCT output',                status: 'active' },
  { material_id: 'MAT-RELAY',             material_name: 'Dual-Pole Relay',           material_type: 'child_part',        traceability_level: 'lot',        source_usage: 'TRSS input',                status: 'active' },
  { material_id: 'MAT-RELAY-SHIELD',      material_name: 'Relay Shields',             material_type: 'child_part',        traceability_level: 'lot',        source_usage: 'TRSS input',                status: 'active' },
  { material_id: 'MAT-TERMINAL-BLOCK',    material_name: 'Terminal Block',            material_type: 'child_part',        traceability_level: 'lot',        source_usage: 'TRSS input',                status: 'active' },
  { material_id: 'MAT-BRASS-TERMINAL',    material_name: 'Brass Terminal',            material_type: 'child_part',        traceability_level: 'lot',        source_usage: 'TRSS input',                status: 'active' },
  { material_id: 'MAT-SCREW-M4X12',       material_name: 'Terminal Screw M4x12',      material_type: 'child_part',        traceability_level: 'lot',        source_usage: 'TRSS input',                status: 'active' },
  { material_id: 'MAT-TRSS',              material_name: 'TRSS Sub-Assembly',         material_type: 'subassembly',       traceability_level: 'lot',        source_usage: '1P input',                  status: 'active' },
  { material_id: 'MAT-METER-BASE',        material_name: 'Meter Base',                material_type: 'child_part',        traceability_level: 'lot',        source_usage: '1P input',                  status: 'active' },
  { material_id: 'MAT-TOP-COVER',         material_name: 'Top Cover Assembly',        material_type: 'child_part',        traceability_level: 'lot',        source_usage: '1P input',                  status: 'active' },
  { material_id: 'MAT-SEAL-LH',           material_name: 'Seal LH',                   material_type: 'child_part',        traceability_level: 'lot',        source_usage: '1P input',                  status: 'active' },
  { material_id: 'MAT-SEAL-RH',           material_name: 'Seal RH',                   material_type: 'child_part',        traceability_level: 'lot',        source_usage: '1P input',                  status: 'active' },
  { material_id: 'MAT-MODULE-COVER',      material_name: 'Module Cover',              material_type: 'child_part',        traceability_level: 'lot',        source_usage: 'WH VC input',               status: 'active' },
  { material_id: 'MAT-TERMINAL-COVER',    material_name: 'Terminal Cover',            material_type: 'child_part',        traceability_level: 'lot',        source_usage: 'final packaging',           status: 'active' },
  { material_id: 'MAT-ENCLOSURE',         material_name: 'Enclosure Assembly',        material_type: 'child_part',        traceability_level: 'lot',        source_usage: 'final packaging',           status: 'active' },
  { material_id: 'MAT-SIM',               material_name: 'SIM Card',                  material_type: 'child_part',        traceability_level: 'serial',     source_usage: 'WH VC input',               status: 'active' },
  { material_id: 'MAT-CUSTOMER-SEAL',     material_name: 'Customer-Specific Seal',    material_type: 'child_part',        traceability_level: 'serial/lot', source_usage: 'WH VC input',               status: 'active' },
  { material_id: 'MAT-M800-SFG',          material_name: 'M800 Semi-Finished Meter',  material_type: 'SFG',               traceability_level: 'serial',     source_usage: 'KMP output / WH VC input',  status: 'active' },
  { material_id: 'MAT-M800-FG',           material_name: 'M800 Finished Good Meter',  material_type: 'FG',                traceability_level: 'serial',     source_usage: 'dispatchable after release',status: 'active' },
  { material_id: 'MAT-ACCESSORY-KIT',     material_name: 'Accessory Kit',             material_type: 'packing_material',  traceability_level: 'lot',        source_usage: 'final packaging',           status: 'active' },
  { material_id: 'MAT-CORRUGATED-CARTON', material_name: 'Corrugated Carton',         material_type: 'packing_material',  traceability_level: 'lot',        source_usage: 'final packaging',           status: 'active' },
  { material_id: 'MAT-EMPTY-BIN',         material_name: 'Empty Returnable Bin',      material_type: 'container_asset',   traceability_level: 'ID/batch',   source_usage: 'reverse logistics',         status: 'active' }
];

export const material_state = [
  { state_id: 'RM_SUPPLIER',       state_name: 'Supplier raw material',       state_type: 'external' },
  { state_id: 'RM_RECEIVED_KMP',   state_name: 'Received at KMP',             state_type: 'inbound' },
  { state_id: 'RM_DOCKED',         state_name: 'Docked / staged',             state_type: 'inbound' },
  { state_id: 'RM_IQC_HOLD',       state_name: 'Under IQC hold',              state_type: 'hold' },
  { state_id: 'RM_IQC_PASS',       state_name: 'IQC passed raw material',     state_type: 'released' },
  { state_id: 'RM_ESTORE_STOCK',   state_name: 'Electronic store stock',       state_type: 'storage' },
  { state_id: 'SMT_LINE_WIP',      state_name: 'SMT line WIP',                state_type: 'WIP' },
  { state_id: 'PCBA_WIP',          state_name: 'Post-SMT PCBA WIP',            state_type: 'WIP' },
  { state_id: 'PCBA_FCT_PASS',     state_name: 'FCT-passed PCBA',             state_type: 'released' },
  { state_id: 'TRSS_CHILD_WIP',    state_name: 'TRSS child part WIP',         state_type: 'WIP' },
  { state_id: 'TRSS_READY',        state_name: 'TRSS subassembly ready',       state_type: 'released' },
  { state_id: 'BOP_LINE_WIP',      state_name: 'Plastic/BOP line WIP',        state_type: 'WIP' },
  { state_id: 'LINE_WIP',          state_name: '1P assembly line WIP',         state_type: 'WIP' },
  { state_id: 'SFG_METER',         state_name: 'Semi-finished meter',          state_type: 'SFG' },
  { state_id: 'SFG_BINNED',        state_name: 'SFG in 10-meter bin',         state_type: 'packed_WIP' },
  { state_id: 'SFG_PALLETIZED',    state_name: 'SFG palletized',              state_type: 'packed_WIP' },
  { state_id: 'SFG_WH_HOLD',       state_name: 'SFG in WH ASRS',             state_type: 'storage' },
  { state_id: 'SFG_AT_VC',         state_name: 'SFG at Value Creation',       state_type: 'WIP' },
  { state_id: 'VC_METER',          state_name: 'NIC/SIM/seal completed meter',state_type: 'WIP' },
  { state_id: 'VC_METER_PACK_WIP',  state_name: 'VC meter at packaging input', state_type: 'WIP' },
  { state_id: 'POST_SCREEN_METER', state_name: 'Screened/laser/holo meter',   state_type: 'WIP' },
  { state_id: 'PACKED_FG',         state_name: 'Packed finished good',         state_type: 'FG' },
  { state_id: 'FG_QA_HOLD',        state_name: 'FG under QA/FAT hold',        state_type: 'hold' },
  { state_id: 'FG_RELEASED',       state_name: 'QA released FG',              state_type: 'released' },
  { state_id: 'DISPATCH_STAGED',   state_name: 'FG staged for dispatch',       state_type: 'staging' },
  { state_id: 'DISPATCHED',        state_name: 'Dispatched to customer',       state_type: 'closed' },
  { state_id: 'EMPTY_BIN',         state_name: 'Empty bin at source',         state_type: 'reverse' },
  { state_id: 'EMPTY_BIN_DOCK3',   state_name: 'Empty bin at KMP Dock-3',      state_type: 'reverse' },
  { state_id: 'NG_HOLD',           state_name: 'Failed or blocked material',    state_type: 'exception' },
  { state_id: 'REWORK',            state_name: 'Material under rework',       state_type: 'exception' },
  { state_id: 'SCRAP',             state_name: 'Scrapped material',           state_type: 'closed' },
  { state_id: 'DOC_HOLD',          state_name: 'Documentation mismatch hold',  state_type: 'exception' },
  { state_id: 'SHORTAGE_HOLD',     state_name: 'Material shortage hold',      state_type: 'exception' },
  { state_id: 'LOCATION_HOLD',     state_name: 'Location/system block',       state_type: 'exception' },
  { state_id: 'ORDER_HOLD',        state_name: 'MTO/order sequencing hold',   state_type: 'exception' },
  { state_id: 'RELEASE_HOLD',      state_name: 'QA/SAP release hold',         state_type: 'exception' },
  { state_id: 'DAMAGED_BIN_HOLD',  state_name: 'Damaged bin hold',            state_type: 'exception' }
];

export const container = [
  { container_id: 'CONT-ESD-BIN',          container_type: 'ESD Bin',        capacity: '40 PCBAs/bin',            parent_supported: 'pallet',            returnable: 'yes', owner: 'KMP',              status: 'active' },
  { container_id: 'CONT-ESD-PALLET',       container_type: 'ESD Bin Pallet', capacity: '32 ESD bins = 1,280 PCBAs', parent_supported: 'none',              returnable: 'yes', owner: 'KMP',              status: 'active' },
  { container_id: 'CONT-ESD-TRAY',         container_type: 'ESD Tray',       capacity: 'TBD TRSS/tray',           parent_supported: 'pallet/bin',        returnable: 'yes', owner: 'KMP',              status: 'active' },
  { container_id: 'CONT-LEAP-BIN',         container_type: 'Leap Bin',       capacity: 'varies by part',          parent_supported: 'pallet',            returnable: 'yes', owner: 'Supplier/KMP/WH',   status: 'active' },
  { container_id: 'CONT-SFG-BIN',          container_type: 'SFG Bin',        capacity: '10 meters/bin',           parent_supported: 'pallet',            returnable: 'yes', owner: 'KMP/WH',            status: 'active' },
  { container_id: 'CONT-SFG-PALLET',       container_type: 'SFG Pallet',     capacity: '25 bins = 250 meters',    parent_supported: 'none',              returnable: 'yes', owner: 'KMP/WH',            status: 'active' },
  { container_id: 'CONT-NIC-BIN',          container_type: 'NIC Bin',        capacity: '30 NIC/bin',              parent_supported: 'pallet',            returnable: 'yes', owner: 'WH',                status: 'active' },
  { container_id: 'CONT-MODULE-COVER-BIN', container_type: 'Module Cover Bin',capacity: '30 covers/bin',          parent_supported: 'pallet',            returnable: 'yes', owner: 'WH',                status: 'active' },
  { container_id: 'CONT-SEAL-BIN',         container_type: 'Seal Bin',       capacity: '500 seals/bin',           parent_supported: 'pallet',            returnable: 'yes', owner: 'WH',                status: 'active' },
  { container_id: 'CONT-FG-CARTON',        container_type: 'FG Carton',      capacity: '10 meters/carton',        parent_supported: 'pallet',            returnable: 'no',  owner: 'WH',                status: 'active' },
  { container_id: 'CONT-FG-PALLET',        container_type: 'FG Pallet',      capacity: 'TBD cartons/pallet',      parent_supported: 'none',              returnable: 'no/reusable pallet', owner: 'WH', status: 'active' },
  { container_id: 'CONT-TRUCK',            container_type: 'Covered Truck',  capacity: 'truckload',              parent_supported: 'none',              returnable: 'no',  owner: 'Logistics',         status: 'active' }
];

// ─── 6. CONTROL LOGIC ────────────────────────────────────────────────────────

export const quality_gate = [
  { gate_id: 'GATE-KMP-DOC',       process_id: 'PROC-KMP-INBOUND',          check_type: 'document/security',                     sample_size: '100% lots',             pass_state: 'RM_RECEIVED_KMP',  fail_state: 'DOC_HOLD',             record: 'Gate Entry Register' },
  { gate_id: 'GATE-KMP-IQC',       process_id: 'PROC-KMP-GRN-IQC',          check_type: 'dimensional/visual/functional',         sample_size: 'per FR-QA-53',          pass_state: 'RM_IQC_PASS',      fail_state: 'RM_IQC_HOLD / NG_HOLD', record: 'FR-QA-53' },
  { gate_id: 'GATE-SMT-AOI',       process_id: 'PROC-KMP-SMT',              check_type: 'AOI + QR/MES link',                    sample_size: '100% PCBA',             pass_state: 'PCBA_WIP',         fail_state: 'NG_HOLD',              record: 'AOI Record / FR-QA-26' },
  { gate_id: 'GATE-FCT',           process_id: 'PROC-KMP-FCT',              check_type: 'intelligent functional test',          sample_size: '100% PCBA',             pass_state: 'PCBA_FCT_PASS',    fail_state: 'NG_HOLD',              record: 'FCT log / MES traceability' },
  { gate_id: 'GATE-TRSS-TORQUE',   process_id: 'PROC-KMP-TRSS-ASSEMBLY',    check_type: 'torque + visual',                       sample_size: 'process check',         pass_state: 'TRSS_READY',       fail_state: 'NG_HOLD',              record: 'FR-QA-26 / Torque record' },
  { gate_id: 'GATE-SPM-MESQC',     process_id: 'PROC-KMP-1P-SPM',           check_type: '9 SPM tests + MES QC',                 sample_size: '100% meter',            pass_state: 'SFG_METER',        fail_state: 'NG_HOLD',              record: 'Meter Factory Report' },
  { gate_id: 'GATE-SFG-BIN',       process_id: 'PROC-KMP-SFG-BOX',          check_type: 'count + visual + traceability',         sample_size: '10 meters/bin',         pass_state: 'SFG_BINNED',       fail_state: 'NG_HOLD',              record: 'MES traceability record' },
  { gate_id: 'GATE-VC-NIC-SYNC',   process_id: 'PROC-WH-NIC-SIM-SEAL',      check_type: 'NIC sync + SIM masterlist + lock',      sample_size: '100% meter',            pass_state: 'VC_METER',         fail_state: 'NG_HOLD',              record: 'MES NIC sync log' },
  { gate_id: 'GATE-SCREEN-LASER',  process_id: 'PROC-WH-SCREEN-LASER-HOLO', check_type: 'accuracy, NIC comm, print, hologram QR',sample_size: '100% meter',            pass_state: 'POST_SCREEN_METER',fail_state: 'NG_HOLD',              record: 'MES factory report' },
  { gate_id: 'GATE-AUTO-PACK',     process_id: 'PROC-WH-AUTO-PACK',         check_type: 'carton qty, FG label, SAP FG',         sample_size: '10 meters/carton',      pass_state: 'PACKED_FG',        fail_state: 'NG_HOLD',              record: 'MES factory file / SAP FG record' },
  { gate_id: 'GATE-FG-ASRS',       process_id: 'PROC-WH-FG-ASRS-PUTAWAY',   check_type: 'FG status hold',                        sample_size: '100% pallet',           pass_state: 'FG_QA_HOLD',       fail_state: 'LOCATION_HOLD',        record: 'WMS FG putaway' },
  { gate_id: 'GATE-PDI-FAT',       process_id: 'PROC-KMP-PDI-FAT',          check_type: 'PDI + FAT',                             sample_size: 'Sample rule: n=5/n=32', pass_state: 'FG_RELEASED',      fail_state: 'FG_QA_HOLD / NG_HOLD', record: 'FAT Report / PDIR / SAP QA' },
  { gate_id: 'GATE-DISPATCH',      process_id: 'PROC-WH-DISPATCH',          check_type: 'HHT scan + dispatch docs',              sample_size: '100% cartons/pallets',  pass_state: 'DISPATCHED',       fail_state: 'DOC_HOLD',             record: 'Dispatch Note / POD' },
  { gate_id: 'GATE-EMPTY-BIN',     process_id: 'PROC-KMP-EMPTYBIN-RETURN',  check_type: 'empty count + condition',               sample_size: 'per shift/trip',        pass_state: 'EMPTY_BIN_DOCK3',  fail_state: 'DAMAGED_BIN_HOLD',     record: 'Empty bin count log' }
];

export const system_event = [
  { system_event_id: 'EVT-KMP-GER',        process_id: 'PROC-KMP-INBOUND',         system_name: 'Gate Register / SAP',   transaction_name: 'Gate entry',                  mandatory: 'yes' },
  { system_event_id: 'EVT-KMP-SAP-GRN',    process_id: 'PROC-KMP-GRN-IQC',         system_name: 'SAP',                   transaction_name: 'GRN by HHT scanner',          mandatory: 'yes' },
  { system_event_id: 'EVT-KMP-WMS-PUTAWAY',process_id: 'PROC-KMP-ESTORE-PUTAWAY',  system_name: 'SAP WMS',               transaction_name: 'Electronic store putaway',    mandatory: 'yes' },
  { system_event_id: 'EVT-KMP-SAP-GI',     process_id: 'PROC-KMP-SMT-ISSUE',       system_name: 'SAP/MES',               transaction_name: 'Material issue per MO',       mandatory: 'yes' },
  { system_event_id: 'EVT-KMP-MES-QR',     process_id: 'PROC-KMP-SMT',             system_name: 'MES',                   transaction_name: 'QR scan per PCBA',            mandatory: 'yes' },
  { system_event_id: 'EVT-KMP-MES-FCT',     process_id: 'PROC-KMP-FCT',             system_name: 'MES',                   transaction_name: 'FCT result + QR scan',        mandatory: 'yes' },
  { system_event_id: 'EVT-KMP-MES-TRSS',    process_id: 'PROC-KMP-TRSS-ASSEMBLY',   system_name: 'MES',                   transaction_name: 'TRSS scan / batch link',      mandatory: 'yes' },
  { system_event_id: 'EVT-KMP-MES-SPM',     process_id: 'PROC-KMP-1P-SPM',          system_name: 'MES',                   transaction_name: 'SPM + MES QC factory report',  mandatory: 'yes' },
  { system_event_id: 'EVT-KMP-MES-SFG-PAL', process_id: 'PROC-KMP-SFG-BOX',         system_name: 'MES',                   transaction_name: 'meter-bin-pallet link',       mandatory: 'yes' },
  { system_event_id: 'EVT-WH-WMS-ASRS-PUT', process_id: 'PROC-WH-SFG-ASRS-PUTAWAY', system_name: 'SAP WMS',               transaction_name: 'ASRS putaway + location',     mandatory: 'yes' },
  { system_event_id: 'EVT-WH-WMS-ASRS-RET', process_id: 'PROC-WH-SFG-RETRIEVE-VC',  system_name: 'SAP WMS',               transaction_name: 'ASRS retrieval',              mandatory: 'yes' },
  { system_event_id: 'EVT-WH-MES-NIC',     process_id: 'PROC-WH-NIC-SIM-SEAL',     system_name: 'MES / Unity',           transaction_name: 'NIC sync + IMEI/SIM link',    mandatory: 'yes' },
  { system_event_id: 'EVT-WH-EKANBAN',     process_id: 'PROC-WH-VC-TO-PACK',       system_name: 'E-Kanban / MES',        transaction_name: 'MTO sequencing check',        mandatory: 'yes' },
  { system_event_id: 'EVT-WH-MES-HOLO',     process_id: 'PROC-WH-SCREEN-LASER-HOLO',system_name: 'MES',                   transaction_name: 'Hologram QR + print link',    mandatory: 'yes' },
  { system_event_id: 'EVT-WH-SAP-FG',      process_id: 'PROC-WH-AUTO-PACK',        system_name: 'SAP / MES',             transaction_name: 'SAP FG creation + carton file',mandatory: 'yes' },
  { system_event_id: 'EVT-WH-WMS-FG-PUT',   process_id: 'PROC-WH-FG-ASRS-PUTAWAY',  system_name: 'SAP WMS',               transaction_name: 'FG ASRS putaway',             mandatory: 'yes' },
  { system_event_id: 'EVT-KMP-SAP-QA-REL',  process_id: 'PROC-KMP-PDI-FAT',         system_name: 'SAP QA',                transaction_name: 'QA lot release after FAT pass',mandatory: 'yes' },
  { system_event_id: 'EVT-WH-HHT-DISPATCH', process_id: 'PROC-WH-DISPATCH-STAGE',  system_name: 'SAP Dispatch / HHT',    transaction_name: 'carton scan vs dispatch note', mandatory: 'yes' },
  { system_event_id: 'EVT-WH-POD',          process_id: 'PROC-WH-DISPATCH',         system_name: 'SAP Dispatch',          transaction_name: 'POD / order closure',          mandatory: 'yes' },
  { system_event_id: 'EVT-EMPTYBIN-MANUAL', process_id: 'PROC-KMP-EMPTYBIN-RETURN', system_name: 'Manual Log',            transaction_name: 'empty bin count per shift',   mandatory: 'yes' }
];

// ─── 7. LIVE TWIN ────────────────────────────────────────────────────────────

export const inventory_position = [
  { inventory_id: 'INV-001', material_id: 'MAT-BARE-PCB',  state_id: 'RM_ESTORE_STOCK', location_id: 'LOC-KMP-FF-ESTORE',  container_id: 'CONT-ESD-BIN',    quantity: 0, last_updated: 'TBD', source: 'SAP/WMS' },
  { inventory_id: 'INV-002', material_id: 'MAT-PCBA',      state_id: 'PCBA_FCT_PASS',   location_id: 'LOC-KMP-GF-FCT',      container_id: 'CONT-ESD-BIN',    quantity: 0, last_updated: 'TBD', source: 'MES' },
  { inventory_id: 'INV-003', material_id: 'MAT-TRSS',      state_id: 'TRSS_READY',      location_id: 'LOC-KMP-SF-A-TRSS',   container_id: 'CONT-ESD-TRAY',   quantity: 0, last_updated: 'TBD', source: 'MES' },
  { inventory_id: 'INV-004', material_id: 'MAT-M800-SFG',  state_id: 'SFG_WH_HOLD',     location_id: 'LOC-WH-GF-ASRS',      container_id: 'CONT-SFG-PALLET', quantity: 0, last_updated: 'TBD', source: 'WMS' },
  { inventory_id: 'INV-005', material_id: 'MAT-M800-SFG',  state_id: 'SFG_AT_VC',       location_id: 'LOC-WH-GF-VC',        container_id: 'CONT-SFG-BIN',    quantity: 0, last_updated: 'TBD', source: 'MES/WMS' },
  { inventory_id: 'INV-006', material_id: 'MAT-M800-FG',   state_id: 'FG_QA_HOLD',      location_id: 'LOC-WH-GF-FG-ASRS',   container_id: 'CONT-FG-PALLET',  quantity: 0, last_updated: 'TBD', source: 'SAP/WMS' },
  { inventory_id: 'INV-007', material_id: 'MAT-M800-FG',   state_id: 'FG_RELEASED',     location_id: 'LOC-WH-GF-FG-ASRS',   container_id: 'CONT-FG-PALLET',  quantity: 0, last_updated: 'TBD', source: 'SAP QA/WMS' },
  { inventory_id: 'INV-008', material_id: 'MAT-M800-FG',   state_id: 'DISPATCH_STAGED', location_id: 'LOC-WH-GF-DISPATCH',  container_id: 'CONT-FG-PALLET',  quantity: 0, last_updated: 'TBD', source: 'SAP Dispatch/HHT' },
  { inventory_id: 'INV-009', material_id: 'MAT-EMPTY-BIN', state_id: 'EMPTY_BIN',       location_id: 'LOC-WH-GF-VC',        container_id: 'CONT-LEAP-BIN',   quantity: 0, last_updated: 'TBD', source: 'manual' }
];

export const live_status = [
  { object_type: 'station',  object_id: 'ST-KMP-SMT-01',      status: 'unknown', current_location_id: 'LOC-KMP-GF-SMT',     timestamp: 'TBD', source: 'MES/manual' },
  { object_type: 'station',  object_id: 'ST-KMP-FCT-01',      status: 'unknown', current_location_id: 'LOC-KMP-GF-FCT',     timestamp: 'TBD', source: 'MES/manual' },
  { object_type: 'station',  object_id: 'ST-KMP-SPM-01',      status: 'unknown', current_location_id: 'LOC-KMP-SF-B-1P',     timestamp: 'TBD', source: 'MES/manual' },
  { object_type: 'station',  object_id: 'ST-WH-VC-01',        status: 'unknown', current_location_id: 'LOC-WH-GF-VC',       timestamp: 'TBD', source: 'MES/manual' },
  { object_type: 'station',  object_id: 'ST-WH-AUTOPACK-01',  status: 'unknown', current_location_id: 'LOC-WH-GF-PACK',     timestamp: 'TBD', source: 'MES/manual' },
  { object_type: 'station',  object_id: 'ST-KMP-FAT-01',      status: 'unknown', current_location_id: 'LOC-KMP-3F-FAT',     timestamp: 'TBD', source: 'SAP QA/manual' },
  { object_type: 'resource', object_id: 'RES-ASRS-CRANE',     status: 'unknown', current_location_id: 'LOC-WH-GF-ASRS',     timestamp: 'TBD', source: 'WMS' },
  { object_type: 'resource', object_id: 'RES-VRC-KMP',        status: 'unknown', current_location_id: 'LOC-KMP-GF-VRC',      timestamp: 'TBD', source: 'manual/IoT' },
  { object_type: 'resource', object_id: 'RES-MAT-LIFT-KMP',   status: 'unknown', current_location_id: 'LOC-KMP-GF-LIFT',     timestamp: 'TBD', source: 'manual/IoT' },
  { object_type: 'path',     object_id: 'PATH-KMP-SFG-WH-ASRS',status: 'unknown', current_location_id: 'LOC-KMP-SF-RAMP',     timestamp: 'TBD', source: 'WMS/manual' }
];

// ─── 8. HISTORY ──────────────────────────────────────────────────────────────

export const event_log = [
  { event_id: 'LOG-TEMPLATE-001', timestamp: 'TBD', event_type: 'scan',          object_id: 'meter/bin/pallet ID', from_location_id: 'TBD',                 to_location_id: 'TBD',          process_id: 'TBD',                 state_before: 'TBD',             state_after: 'TBD',             system_source: 'MES/WMS/SAP/HHT' },
  { event_id: 'LOG-TEMPLATE-002', timestamp: 'TBD', event_type: 'move_start',    object_id: 'movement_order_id',   from_location_id: 'TBD',                 to_location_id: 'TBD',          process_id: 'TBD',                 state_before: 'TBD',             state_after: 'TBD',             system_source: 'WMS/HHT/manual' },
  { event_id: 'LOG-TEMPLATE-003', timestamp: 'TBD', event_type: 'move_complete', object_id: 'movement_order_id',   from_location_id: 'TBD',                 to_location_id: 'TBD',          process_id: 'TBD',                 state_before: 'TBD',             state_after: 'TBD',             system_source: 'WMS/HHT/manual' },
  { event_id: 'LOG-TEMPLATE-004', timestamp: 'TBD', event_type: 'quality_pass',   object_id: 'material_serial/lot', from_location_id: 'TBD',                 to_location_id: 'TBD',          process_id: 'process_id',          state_before: 'input_state',     state_after: 'pass_state',      system_source: 'MES/QA' },
  { event_id: 'LOG-TEMPLATE-005', timestamp: 'TBD', event_type: 'quality_fail',   object_id: 'material_serial/lot', from_location_id: 'TBD',                 to_location_id: 'TBD',          process_id: 'process_id',          state_before: 'input_state',     state_after: 'NG_HOLD',         system_source: 'MES/QA' },
  { event_id: 'LOG-TEMPLATE-006', timestamp: 'TBD', event_type: 'release',        object_id: 'lot_id',              from_location_id: 'TBD',                 to_location_id: 'TBD',          process_id: 'PROC-KMP-PDI-FAT',    state_before: 'FG_QA_HOLD',      state_after: 'FG_RELEASED',     system_source: 'SAP QA' },
  { event_id: 'LOG-TEMPLATE-007', timestamp: 'TBD', event_type: 'dispatch',       object_id: 'carton/pallet/order', from_location_id: 'LOC-WH-GF-DISPATCH', to_location_id: 'LOC-CUSTOMER', process_id: 'PROC-WH-DISPATCH',   state_before: 'DISPATCH_STAGED', state_after: 'DISPATCHED',      system_source: 'SAP Dispatch/HHT' }
];

// ─── 9. SCENARIO OVERRIDES (shocks / what-if changes) ─────────────────────────

export const scenario_override = [
  {
    scenario_id: 'SCN-FCT-BOTTLENECK',
    scenario_name: 'FCT Bottleneck (single station)',
    entity_type: 'process',
    entity_id: 'PROC-KMP-FCT',
    change_type: 'modify',
    field_name: 'rate_multiplier',
    new_value: 0.3,
    reason: 'Simulate single FCT station throughput constraint',
    affected_path: 'PATH-SMT-FCT',
  },
  {
    scenario_id: 'SCN-SMT-JAM',
    scenario_name: 'SMT Line Jam',
    entity_type: 'process',
    entity_id: 'PROC-KMP-SMT',
    change_type: 'modify',
    field_name: 'rate_multiplier',
    new_value: 0.0,
    reason: 'Simulate SMT paste/reflow breakdown blocking PCBA output',
    affected_path: 'PATH-VRC-GF-SMT',
  },
  {
    scenario_id: 'SCN-RAMP-BLOCK',
    scenario_name: 'Ramp Connection Blocked',
    entity_type: 'path',
    entity_id: 'PATH-KMP-SFG-WH-ASRS',
    change_type: 'modify',
    field_name: 'rate_multiplier',
    new_value: 0.0,
    reason: 'Simulate blocked KMP→WH ramp (SFG cannot leave KMP)',
    affected_path: 'PATH-KMP-SFG-WH-ASRS',
  },
  {
    scenario_id: 'SCN-WH-VC-SLOW',
    scenario_name: 'Value Creation Slowdown',
    entity_type: 'process',
    entity_id: 'PROC-WH-NIC-SIM-SEAL',
    change_type: 'modify',
    field_name: 'rate_multiplier',
    new_value: 0.4,
    reason: 'Simulate NIC sync issues or SIM card shortage at WH VC',
    affected_path: 'PATH-WH-ASRS-VC',
  },
  {
    scenario_id: 'SCN-ADD-FCT-02',
    scenario_name: 'Add second FCT station',
    entity_type: 'station',
    entity_id: 'ST-KMP-FCT-02',
    change_type: 'add',
    field_name: 'rate_multiplier',
    new_value: 2.0,
    reason: 'Reduce FCT bottleneck by doubling test capacity',
    affected_path: 'PATH-SMT-FCT',
  },
  {
    scenario_id: 'SCN-AMR-WH-VC-PACK',
    scenario_name: 'AMR replaces HPT (VC → Pack)',
    entity_type: 'path',
    entity_id: 'PATH-VC-PACK',
    change_type: 'modify',
    field_name: 'rate_multiplier',
    new_value: 1.5,
    reason: 'AMR higher throughput than manual HPT movement',
    affected_path: 'PATH-VC-PACK',
  },
];

// Simulation flow rates (units/tick) derived statically to preserve
// happy path rates for standard simulation edges.
export const sim_rates = {
  'PATH-SUP-KMP-GATE':      0.5,
  'PATH-KMP-GATE-DOCK3':    0.5,
  'PATH-DOCK3-IQC':         0.45,
  'PATH-IQC-LIFT-GF':       0.4,
  'PATH-LIFT-GF-FF':        0.4,
  'PATH-LIFT-FF-ESTORE':    0.4,
  'PATH-ESTORE-VRC-FF':     0.35,
  'PATH-VRC-FF-GF':         0.35,
  'PATH-VRC-GF-SMT':        0.35,
  'PATH-SMT-FCT':           0.3,
  'PATH-FCT-VRC-GF':        0.28,
  'PATH-VRC-GF-SF':         0.28,
  'PATH-VRC-SF-TRSS':       0.25,
  'PATH-TRSS-BWIP':         0.25,
  'PATH-WH-ASRS-KMP-SF':    0.25,
  'PATH-BWIP-1P':           0.25,
  'PATH-1P-SFG-PACK':       0.25,
  'PATH-KMP-SFG-WH-ASRS':   0.22,
  'PATH-WH-ASRS-VC':        0.22,
  'PATH-VC-PACK':           0.22,
  'PATH-PACK-FG-ASRS':      0.2,
  'PATH-FG-ASRS-DISPATCH':  0.2,
  'PATH-DISPATCH-CUSTOMER': 0.18,
  'PATH-KMP-EMPTYBIN-DOCK3':0.2,
  'PATH-WH-VC-EMPTYBIN-KMP':0.15,
};

// Dynamically construct buffer capacities from location nodes
export const buffer_capacity = {};
for (const loc of location_node) {
  if (loc.capacity_limit !== undefined && loc.capacity_limit !== null) {
    buffer_capacity[loc.location_id] = loc.capacity_limit;
  }
}

// Dynamically construct initial fill levels from location nodes
export const initial_fill = {};
for (const loc of location_node) {
  if (loc.initial_fill_ratio !== undefined && loc.initial_fill_ratio !== null) {
    initial_fill[loc.location_id] = loc.initial_fill_ratio;
  }
}
