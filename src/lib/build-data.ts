export const categories = ["frame", "motors", "flightController", "esc", "propellers", "battery", "camera", "receiver"] as const;
export type Category = typeof categories[number];
export type Product = {
  id: string; category: Category; name: string; spec: string; price: number; weight: number;
  frameInches?: number; mount?: string; propInches?: number; motorSize?: number;
  voltage?: number; minVoltage?: number; maxVoltage?: number; connector?: string; escInput?: string;
  thrust?: number; current?: number; escAmps?: number; batteryMah?: number; video?: string;
};
export type BuildSelection = Partial<Record<Category, string>>;
export const categoryNames: Record<Category, string> = {
  frame: "Frame", motors: "Motors", flightController: "Flight Controller", esc: "ESC",
  propellers: "Propellers", battery: "Battery", camera: "Camera", receiver: "Receiver",
};
// Demo specifications and prices are illustrative, not verified manufacturer listings or live offers.
export const products: Product[] = [
  { id:"frame5", category:"frame", name:"iFlight Nazgul Evoque F5", spec:'5” freestyle frame · 16×16 mm motor mount', price:59.90, weight:180, frameInches:5, mount:"16x16" },
  { id:"frame7", category:"frame", name:"Explorer 7", spec:'7” long-range frame · 16×16 mm motor mount', price:89.90, weight:230, frameInches:7, mount:"16x16" },
  { id:"frame3", category:"frame", name:"Guarded Cine 3", spec:'3” guarded frame · 9×9 mm motor mount', price:68.90, weight:95, frameInches:3, mount:"9x9" },
  { id:"motors5", category:"motors", name:"T-Motor F60 Pro V 2020", spec:"1950 KV · 2207 · set of 4", price:89.90, weight:136, mount:"16x16", motorSize:2207, minVoltage:4, maxVoltage:6, thrust:1500, current:38 },
  { id:"motors7", category:"motors", name:"Eco Cruiser 2806.5", spec:"1300 KV · 2806.5 · set of 4", price:109.90, weight:200, mount:"16x16", motorSize:2806, minVoltage:4, maxVoltage:6, thrust:1650, current:35 },
  { id:"motors3", category:"motors", name:"Cine Compact 1404", spec:"3800 KV · 1404 · set of 4", price:69.90, weight:60, mount:"9x9", motorSize:1404, minVoltage:3, maxVoltage:4, thrust:550, current:15 },
  { id:"fcF7", category:"flightController", name:"iFlight BLITZ F7", spec:"F7 flight controller · 8-pin ESC connector", price:119.90, weight:18, connector:"8pin", minVoltage:3, maxVoltage:6 },
  { id:"fcF4", category:"flightController", name:"Compact F4 Controller", spec:"F4 flight controller · 6-pin ESC connector", price:64.90, weight:10, connector:"6pin", minVoltage:3, maxVoltage:4 },
  { id:"esc55", category:"esc", name:"T-Motor F55A PRO II", spec:"55 A · 4-in-1 ESC · 8-pin", price:99.90, weight:22, escAmps:55, minVoltage:4, maxVoltage:6, escInput:"8pin" },
  { id:"esc20", category:"esc", name:"Compact 20A ESC", spec:"20 A · 4-in-1 ESC · 6-pin", price:54.90, weight:12, escAmps:20, minVoltage:3, maxVoltage:4, escInput:"6pin" },
  { id:"props5", category:"propellers", name:"HQProp T5x3.5x3", spec:"5” tri-blade · 2 CW + 2 CCW", price:12.90, weight:18, propInches:5 },
  { id:"props7", category:"propellers", name:"Explorer 7x3.5", spec:"7” bi-blade · 2 CW + 2 CCW", price:16.90, weight:26, propInches:7 },
  { id:"props3", category:"propellers", name:"Guarded 3x3x3", spec:"3” tri-blade · 2 CW + 2 CCW", price:10.90, weight:12, propInches:3 },
  { id:"battery6", category:"battery", name:"CNHL Black Series 1500mAh", spec:"6S · 1500 mAh · 150C", price:49.90, weight:240, voltage:6, batteryMah:1500 },
  { id:"battery6long", category:"battery", name:"Explorer 3000mAh", spec:"6S · 3000 mAh · 60C", price:79.90, weight:390, voltage:6, batteryMah:3000 },
  { id:"battery4", category:"battery", name:"Compact 850mAh", spec:"4S · 850 mAh · 100C", price:29.90, weight:110, voltage:4, batteryMah:850 },
  { id:"cameraFpv", category:"camera", name:"RunCam Phoenix 2", spec:"Analog FPV camera", price:39.90, weight:9, video:"analog" },
  { id:"camera4k", category:"camera", name:"Demo 4K Action Camera", spec:"4K recording · action camera mount required", price:159.90, weight:75, video:"4k" },
  { id:"receiver", category:"receiver", name:"TBS Crossfire Nano RX", spec:"2.4 g · radio receiver", price:49.90, weight:3 },
  { id:"receiver2", category:"receiver", name:"Demo ELRS Receiver", spec:"2.4 GHz · radio receiver", price:24.90, weight:2 },
];
export const byId = Object.fromEntries(products.map((p) => [p.id, p])) as Record<string, Product>;
export const presets: Record<string, { name: string; selection: BuildSelection }> = {
  cinematic: { name:"Cinematic 4K Cruiser", selection:{frame:"frame7", motors:"motors7", flightController:"fcF7", esc:"esc55", propellers:"props7", battery:"battery6long", camera:"camera4k", receiver:"receiver"}},
  racer: { name:"Backyard Racer", selection:{frame:"frame5", motors:"motors5", flightController:"fcF7", esc:"esc55", propellers:"props5", battery:"battery6", camera:"cameraFpv", receiver:"receiver"}},
  freestyle: { name:"FPV Freestyle Rig", selection:{frame:"frame5", motors:"motors5", flightController:"fcF7", esc:"esc55", propellers:"props5", battery:"battery6", camera:"cameraFpv", receiver:"receiver2"}},
  longrange: { name:"Long-Range Explorer", selection:{frame:"frame7", motors:"motors7", flightController:"fcF7", esc:"esc55", propellers:"props7", battery:"battery6long", camera:"cameraFpv", receiver:"receiver"}},
};
export type Priority = "footage" | "parkour" | "range" | "beginner";
export function aiPreset(priorities: Priority[], budget: number): {name:string; selection:BuildSelection} {
  const compact = priorities.includes("beginner") && !priorities.includes("range") && !priorities.includes("parkour");
  const long = priorities.includes("range") && !priorities.includes("parkour") && !compact;
  const base = compact ? { frame:"frame3", motors:"motors3", propellers:"props3", battery:"battery4", flightController:"fcF4", esc:"esc20" } : long ? { frame:"frame7", motors:"motors7", propellers:"props7", battery:"battery6long", flightController:"fcF7", esc:"esc55" } : { frame:"frame5", motors:"motors5", propellers:"props5", battery:"battery6", flightController:"fcF7", esc:"esc55" };
  const selection: BuildSelection = { ...base, camera: priorities.includes("footage") && budget >= 700 ? "camera4k" : "cameraFpv", receiver: budget < 500 ? "receiver2" : "receiver" };
  return { name: priorities.includes("footage") ? (long ? "Explorer Video Build" : compact ? "Protected Video Build" : "Cinematic Freestyle Build") : long ? "Long-Range Explorer Build" : compact ? "First Flight Build" : "Freestyle FPV Build", selection };
}
export const money = (amount: number) => new Intl.NumberFormat("de-DE", { style:"currency", currency:"EUR" }).format(amount);
