export { TICKS_PER_SECOND, type Clock } from './clock.ts';
export type {
  AcceptedCommand,
  Command,
  CommandResult,
  MarkerCommand,
  MoveMarkerCommand,
  PlaceMarkerCommand,
  PokeBilgeCommand,
  PuzzleCommand,
  RejectedCommand,
  RejectionReason,
  StartPuzzleCommand,
  SwapBilgeCommand,
} from './commands.ts';
export type {
  BilgeClearedEvent,
  BilgePokedEvent,
  BilgeSwappedEvent,
  BilgeWaterLineMovedEvent,
  MarkerDriftedEvent,
  MarkerEvent,
  MarkerMovedEvent,
  PuzzleEvent,
  PuzzleLevelChangedEvent,
  PuzzleScoredEvent,
  SimEvent,
} from './events.ts';
export { canonicalJson, hashCanonical } from './hash.ts';
export type { EntityId } from './ids.ts';
export { DRIFT_STREAM, FIELD_HEIGHT, FIELD_WIDTH, findMarker } from './marker.ts';
export type { BilgingBalance, DutyRating, PuzzleBalance } from './puzzle/balance.ts';
export {
  BILGE_FILL_STREAM,
  BILGE_REFILL_STREAM,
  BILGE_RULES,
  MAXIMUM_COLOUR_COUNT,
  MINIMUM_COLOUR_COUNT,
  MINIMUM_DRY_ROWS,
  MINIMUM_RUN_LENGTH,
  MINIMUM_WATER_ROWS,
  colourCountOf,
  createBilgeBoard,
  waterLineRowOf,
  waterRowsOf,
} from './puzzle/bilging.ts';
export {
  CRAB_CELL,
  EMPTY_CELL,
  JELLY_CELL,
  PUFFER_CELL,
  cellAt,
  clearCells,
  flatIndexOf,
  isColourCell,
  isInsideBoard,
  refillBoard,
  rowOf,
  swapCells,
  swapPartnerOf,
  type Board,
  type BoardAxis,
  type BoardCell,
  type BoardPosition,
  type BoardRules,
} from './puzzle/board.ts';
export {
  BILGE_CRITTER_STREAM,
  CRAB_MIN_STAR_LEVEL,
  JELLY_MIN_STAR_LEVEL,
  PUFFER_MIN_STAR_LEVEL,
  climbCrabs,
  colourCellsOf,
  crabsAboveWaterLine,
  detonationCellsOf,
  spawnCritters,
  type CritterRules,
} from './puzzle/critters.ts';
export { applyPuzzleCommand } from './puzzle/dispatch.ts';
export { applyGravity, type CellFall } from './puzzle/gravity.ts';
export {
  INTERVALS_PER_FRAME,
  TICKS_PER_INTERVAL,
  createScoringFrame,
  currentIntervalOf,
  performanceOf,
  ratingOf,
  recordMove,
  rotateFrame,
  type IntervalSample,
  type ScoringFrame,
} from './puzzle/frame.ts';
export { stepPointsOf } from './puzzle/move.ts';
export {
  MAXIMUM_RESOLVE_STEPS,
  resolveBoard,
  type OpeningClear,
  type ResolveContext,
  type ResolveKind,
  type ResolveStep,
  type StepClear,
} from './puzzle/resolve.ts';
export { cellsOfRuns, findRuns, type Run } from './puzzle/runs.ts';
export {
  PER_MILLE,
  POINTS_PER_MOVE_AT_FULL_EFFICIENCY,
  basePointsOf,
  chainScoreOf,
  comboMultiplierOf,
  comboScoreOf,
  crabScoreOf,
  movesForEfficiencyMilli,
} from './puzzle/scoring.ts';
export { startBilging, stepPuzzle, type PuzzleState } from './puzzle/session.ts';
export { applyBilgeSwap } from './puzzle/swap.ts';
export type { RngStream, RngStreamCursor, RngStreams } from './rng.ts';
export { deserialise, serialise } from './save.ts';
export { SCHEMA_VERSION, type Marker, type WorldState } from './state.ts';
export { Sim, type SimOptions, type Snapshot } from './sim.ts';
