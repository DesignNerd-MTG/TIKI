export const fixtureIpRatings = ["IP20", "IP21", "IP22", "IP23", "IP40", "IP44", "IP54", "IP55", "IP65", "IP66", "IP67"] as const;
export const maxFixtureWeightLb = 10000;
export function validFixtureWeight(value: number) {
  return Number.isFinite(value) && value > 0 && value <= maxFixtureWeightLb;
}
export function kilogramsToPounds(value: number) {
  return value / 0.45359237;
}
export const fixtureQuickSpecs = ["preferred_mode", "dmx_footprint", "weight_lb", "ip_rating"];
export function formatFixtureWeight(value: number | string) {
  const weight = Number(value);
  return validFixtureWeight(weight) ? `${weight.toFixed(1)} lb` : "Not specified";
}
