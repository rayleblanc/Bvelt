export interface CalibrationRecord {
  id?: string;
  timestamp: string;
  formulaVersion: string;
  inputs: Record<string, any>;
  estimatedRange: { min: number; max: number };
  actualOutcome: number | null;
  errorRate: number | null;
  calibrationStatus: 'PENDING' | 'CALIBRATED' | 'OUTLIER';
}

/**
 * Calibration Engine
 * Prepares Bvelt for future optimization by logging estimated ranges
 * vs real customer outcomes without requiring ML today.
 */
export class CalibrationEngine {
  
  static logEstimate(
    formulaVersion: string, 
    inputs: Record<string, any>, 
    estimatedRange: { min: number; max: number }
  ): CalibrationRecord {
    const record: CalibrationRecord = {
      timestamp: new Date().toISOString(),
      formulaVersion,
      inputs,
      estimatedRange,
      actualOutcome: null,
      errorRate: null,
      calibrationStatus: 'PENDING'
    };
    
    // In the future, this can be synced to Firestore in a background worker
    // to build the calibration dataset.
    console.info('[CalibrationEngine] Estimate logged for future calibration.', { formulaVersion });
    
    return record;
  }

  static provideFeedback(record: CalibrationRecord, actualOutcome: number): CalibrationRecord {
    const midPoint = (record.estimatedRange.min + record.estimatedRange.max) / 2;
    // Prevent division by zero
    const denominator = actualOutcome === 0 ? 1 : actualOutcome;
    const errorRate = Math.abs(midPoint - actualOutcome) / denominator;
    
    return {
      ...record,
      actualOutcome,
      errorRate,
      calibrationStatus: errorRate > 0.5 ? 'OUTLIER' : 'CALIBRATED'
    };
  }
}
