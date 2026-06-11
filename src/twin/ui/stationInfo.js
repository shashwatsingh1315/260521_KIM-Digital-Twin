// stationInfo.js — rich annotations for the KMP M-800 linearLine stations.
//
// Shared by the 3D StationLabel overlays and the 2D ProductionFlowOverview.
// Only applies when station ids match (the linearLine fixture); generic
// configs fall back to name + derived family color.

import { T } from './kit.jsx';

export const STATION_INFO = {
  st_iqc:       { label: 'IQC',          transform: 'Raw → Verified',             color: T.family.inspect },
  st_smt:       { label: 'SMT ×5',       transform: 'PCB → Assembled PCBA',       color: T.family.production },
  st_fct:       { label: 'FCT ×5',       transform: 'PCBA → Tested',              color: T.family.inspect },
  st_trss:      { label: 'TRSS ×5',      transform: 'Parts → TRSS Sub-Assy',      color: T.family.production },
  st_1p:        { label: '1P Assy ×18',  transform: 'PCBA+TRSS+Plastic → Meter',  color: T.family.production },
  st_sfg_pack:  { label: 'SFG Pack ×4',  transform: 'Meters → 10/bin',            color: T.family.production },
  st_asrs:      { label: 'ASRS',         transform: 'Automated Storage',           color: T.family.storage },
  st_vc:        { label: 'VC ×6',        transform: 'SFG+NIC+SIM → VC Meter',     color: T.family.production },
  st_screen:    { label: 'Screen ×3',    transform: 'Laser + Hologram QA',         color: T.family.inspect },
  st_enclosure: { label: 'Enclosure',    transform: 'Robotic Cover Fit',           color: T.family.production },
  st_pack:      { label: 'Pack ×5',      transform: '10/carton → Finished Good',   color: T.family.production },
  st_fat:       { label: 'FAT',          transform: 'Final Acceptance (n=32)',      color: T.family.inspect },
};
