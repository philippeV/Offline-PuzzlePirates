export type DutyRating = 'booched' | 'poor' | 'fine' | 'good' | 'excellent' | 'incredible';

export interface BilgingBalance {
  boardWidth: number;
  boardHeight: number;
  colourCountByStarLevel: number[];
  maxStarLevel: number;
  startingStarLevel: number;
  ticksPerStarStep: number;
  comboMultiplierByLineCount: number[];
  comboScalePerMilleByStarLevel: number[];
  vegasMultiplier: number;
  chainPointsPerCell: number;
  pufferSpawnPerMille: number;
  crabSpawnPerMille: number;
  jellySpawnPerMille: number;
  tokenSpawnPerMille: number;
  crabPointsAtFullWater: number;
  pufferPointsPerCell: number;
  jellyPointsPerCell: number;
  aboveWaterFallTicksPerCell: number;
  belowWaterFallTicksPerCell: number;
  inflowPerMillePerThousandTicks: number;
  pumpPerMillePerThousandTicks: number;
  ratingBandsPerMille: number[];
}

export interface PuzzleBalance {
  bilging: BilgingBalance;
}
