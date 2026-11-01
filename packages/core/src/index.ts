export const PROJECT_NAME = 'Bedford Traffic Safety Explorer';
export type DataConfidence = 'high' | 'medium' | 'low' | 'insufficient';
export type MeasurementSource = { id: string; title: string; url: string; measuredAt?: string };
export type Crossing = { id: string; name: string; longitude: number; latitude: number; sourceIds: string[] };
export type CrossingAssessment = { crossingId: string; score: number | null; confidence: DataConfidence; methodologyVersion: string };
