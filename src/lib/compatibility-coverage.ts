import type { SelectedProducts } from "./build-calculations";
import { fulfillmentProductForCategory } from "./configurator-selection";

/** Existing native rules inspect separate roles. An integration claim alone
 * must not turn omitted current/voltage/interface checks into verified passes. */
export function compatibilityCoverageGaps(selected: SelectedProducts) {
  const gaps: { code: string; explanation: string }[] = [];
  if (!selected.esc && fulfillmentProductForCategory(selected, "esc")) {
    gaps.push(
      {
        code: "INTEGRATED_ESC_VOLTAGE",
        explanation:
          "The integrated ESC voltage limits are not independently checked by the separate-ESC rule.",
      },
      {
        code: "INTEGRATED_ESC_CURRENT",
        explanation:
          "The integrated ESC continuous current rating and exact motor/propeller operating conditions still need verification.",
      },
    );
  }
  if (!selected.flightController && fulfillmentProductForCategory(selected, "flightController")) {
    gaps.push(
      {
        code: "INTEGRATED_FC_VOLTAGE",
        explanation: "The integrated flight-controller supply limits still need verification.",
      },
      {
        code: "INTEGRATED_FC_CAMERA",
        explanation:
          "Integrated flight-controller camera interfaces and power rails still need verification.",
      },
      {
        code: "INTEGRATED_FC_RECEIVER",
        explanation:
          "Integrated flight-controller receiver interfaces and power rails still need verification.",
      },
    );
  }
  return gaps;
}
