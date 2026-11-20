import type { Product } from './build-data';
import { propellerBladeCount } from './component-product-filters';

type Fact = {label:string;value:string};
const number=(value:number)=>new Intl.NumberFormat('en',{maximumFractionDigits:6}).format(value);
function range(min:number|undefined,max:number|undefined,unit:string):string|undefined {
  if(min===undefined&&max===undefined)return undefined;
  if(min===max)return `${number(min!)} ${unit}`;
  if(min===undefined)return `≤ ${number(max!)} ${unit}`;
  if(max===undefined)return `≥ ${number(min)} ${unit}`;
  return `${number(min)}–${number(max)} ${unit}`;
}
/** Presentation only: existing sourced values, with no inferred current, mass or voltage. */
export function productOptionFacts(product:Product):Fact[] {
  const facts:Fact[]=[];
  const add=(label:string,value:string|number|undefined,unit='')=>{
    if(value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value)))return;
    facts.push({label,value:`${typeof value==='number'?number(value):value}${unit?` ${unit}`:''}`});
  };
  const massQualifier=product.weightBasis==='partial'?' (partial)':product.weightBasis==='per_package'?' / pack':product.weightBasis==='installed_set'?' / set':product.weightBasis==='per_item'?' / item':'';
  add('Weight',product.weight,`g${massQualifier}${/\b(?:without|excluding)\s+(?:the\s+)?antennas?\b/i.test(product.weightScope??'')?' · excl. antenna':''}`);
  switch(product.category){
    case 'motors':add('KV',product.motorKv);add('Peak current',product.current,'A');add('Motor size',product.motorSize);break;
    case 'esc':add('Current rating',product.escAmps,'A');add('Battery',range(product.minVoltage,product.maxVoltage,'S'));break;
    case 'battery':add('Capacity',product.batteryMah,'mAh');add('Cells',product.voltage,'S');add('Connector',product.batteryConnector);break;
    case 'frame':add('Size',product.frameInches,'in');add('Motor mount',product.mount??product.mountPatterns?.join(' / '));break;
    case 'propellers':add('Diameter',product.propInches,'in');add('Blades',propellerBladeCount(product)[0]);break;
    case 'receiver':add('Radio system',product.receiverProtocol);add('Frequency',range(product.receiverFrequencyMinMhz,product.receiverFrequencyMaxMhz,'MHz'));add('Signal',product.receiverSignalInterface);break;
    case 'camera':add('Video',product.cameraVideoInterface??product.video);add('Width',product.cameraWidthMm,'mm');add('Supply',range(product.cameraMinVoltageV,product.cameraMaxVoltageV,'V'));break;
    case 'flightController':add('Camera interface',product.fcCameraVideoInterfaces?.join(', '));add('Battery',range(product.minVoltage,product.maxVoltage,'S'));add('ESC connector',product.connector);break;
    case 'videoTransmitter':add('Video',product.videoTransmitterSystem);add('Frequency',range(product.vtxFrequencyMinMhz,product.vtxFrequencyMaxMhz,'MHz'));add('Connector',product.vtxAntennaConnector);break;
    case 'antenna':add('Connector',product.antennaConnector);add('Frequency',range(product.antennaFrequencyMinMhz,product.antennaFrequencyMaxMhz,'MHz'));break;
    case 'radioTransmitter':add('Radio systems',product.radioProtocols?.join(', '));break;
    case 'fpvGoggles':add('Video systems',product.supportedVideoSystems?.join(', '));break;
    case 'batteryCharger':add('Chemistry',product.chargerBatteryChemistries?.join(', '));add('Cells',range(product.chargerMinCells,product.chargerMaxCells,'S'));add('Connector',product.chargerConnectors?.join(', '));break;
    case 'chargingAccessory':add('Connector',product.chargingConnectors?.join(', '));break;
    default:add('Signal',product.deviceSignalInterface);add('Supply',range(product.deviceMinVoltageV,product.deviceMaxVoltageV,'V'));
  }
  if(product.packageQuantity!==undefined&&product.packageQuantity>1)return [...facts.slice(0,3),{label:'Pack',value:`${product.packageQuantity} items`}];
  return facts.slice(0,4);
}
