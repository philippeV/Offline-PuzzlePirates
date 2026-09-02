export type DutyRating = 'booched' | 'poor' | 'fine' | 'good' | 'excellent' | 'incredible';

export interface BilgingBalance {
  boardWidth: number;
  boardHeight: number;
  colourCountByStarLevel: number[];
  maxStarLevel: number;
  startingStarLevel: number;
  ticksPerStarStep: number;
  comboMultiplierByLineCount: number[];
  vegasMultiplier: number;
  chainPointsPerCell: number;
  inflowPerMillePerThousandTicks: number;
  pumpPerMillePerThousandTicks: number;
  ratingBandsPerMille: number[];
}

export interface PuzzleBalance {
  bilging: BilgingBalance;
}
