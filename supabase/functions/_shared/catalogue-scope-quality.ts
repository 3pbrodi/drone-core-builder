/** Conservative manufacturer-import scope checks for the eight DroneCores
 * *complete* component categories. These checks never promote or verify parts:
 * they only exclude unmistakable accessories and correct an explicit 4-in-1
 * ESC incorrectly assigned to flight controllers.
 */
export type MainCategory =
  | "battery" | "camera" | "esc" | "flightController"
  | "frame" | "motors" | "propellers" | "receiver";

export type ScopeAssessment = {
  category: MainCategory | null;
  excluded: boolean;
  reason: string | null;
  categoryCorrected: boolean;
};

export function assessMainComponentScope(
  category: MainCategory | null,
  model: string,
): ScopeAssessment {
  const title = model.normalize("NFKC").toLowerCase().replace(/[-–—_]+/g, " ");
  let corrected = category;
  if (
    category === "flightController" &&
    /\b(?:4\s*in\s*1|4in1)\s*esc\b/i.test(model) &&
    !/\b(?:flight\s*controller|fc\s*[&+]\s*esc|stack|aio)\b/i.test(model)
  ) {
    corrected = "esc";
  }

  const accessoryReason =
    corrected === "battery" &&
      /\b(?:anti\s*slip\s*pad|anti\s*slip\s*mat|battery\s*pads?|ummagrip|grip\s*pads?)\b/.test(title)
      ? "battery pad, not a battery"
    : corrected === "motors" && /\b(?:bearing|bearings|replacement\s*shaft|motor\s*spares?)\b/.test(title)
      ? "motor replacement part, not a complete motor"
    : corrected === "frame" &&
        /\b(?:replacement\s*arm|carbon\s*fiber\s*arm|spare\s*arm|arm\s*for\s*\w+\s*frame)\b/.test(title)
      ? "replacement frame arm, not a complete frame"
    : corrected === "flightController" &&
        /\b(?:external\s*bec|extension\s*module|usb\s*c\s*module|type\s*c\s*module)\b/.test(title)
      ? "FC accessory, not a flight controller"
    : corrected === "propellers" &&
        /\b(?:propeller\s*cap|dalprop\s*cap|gift\s*packs?)\b/.test(title)
      ? "propeller accessory or mixed gift bundle, not a single propeller model"
    : null;

  return {
    category: corrected,
    excluded: accessoryReason !== null,
    reason: accessoryReason,
    categoryCorrected: corrected !== category,
  };
}
