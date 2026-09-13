export const fixtureIpRatings = ["IP20", "IP21", "IP22", "IP23", "IP40", "IP44", "IP54", "IP55", "IP65", "IP66", "IP67"] as const;
export const maxFixtureWeightLb = 10000;
export function validFixtureWattage(value: number) {
  return Number.isFinite(value) && value > 0;
}
export function validFixtureWeight(value: number) {
  return Number.isFinite(value) && value > 0 && value <= maxFixtureWeightLb;
}
export function kilogramsToPounds(value: number) {
  return value / 0.45359237;
}
export const fixtureQuickSpecs = ["preferred_mode", "dmx_footprint", "wattage", "weight_lb", "ip_rating", "power_input_connector"];
export function formatFixtureWattage(value: number | string) {
  const wattage = Number(value);
  return validFixtureWattage(wattage) ? `${wattage.toLocaleString(undefined, { maximumFractionDigits: 2, useGrouping: false })} W` : "Not specified";
}
export function formatFixtureWeight(value: number | string) {
  const weight = Number(value);
  return validFixtureWeight(weight) ? `${weight.toFixed(1)} lb` : "Not specified";
}
