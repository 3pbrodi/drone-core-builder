import type { Category, Product } from './build-data';
import type { CatalogueEvidenceSnapshot } from './catalogue-evidence';

export const UNKNOWN_FILTER_VALUE = '__not_specified__';
// Reference photographs are not 3D previews. No actual product renderer is registered yet.
export const product3DPreviewIds: ReadonlySet<string> = new Set<string>();
export type ComponentFilters = {
  price: [number, number] | null;
  manufacturer: string;
  compatible: boolean;
  preview3D: boolean;
  attributes: Record<string, string>;
};
export const emptyComponentFilters = (): ComponentFilters => ({price:null,manufacturer:'',compatible:false,preview3D:false,attributes:{}});
type Facet = {key: string; label: string; values: (product: Product) => string[]};
const field = (key: keyof Product, label: string): Facet => ({key,label,values:p=>{
  const value=p[key];
  return Array.isArray(value) ? value.filter((x): x is string => typeof x==='string') :
    typeof value==='number' && Number.isFinite(value) || typeof value==='string' && value.trim() ? [String(value)] : [];
}});
export function propellerBladeCount(product: Product): string[] {
  // Use explicit descriptive blade counts only; model/SKU dimension strings can be ambiguous.
  const text=product.spec;
  const counts=new Set<string>();
  for(const match of text.matchAll(/\b([2-9])\s*[- ]?\s*blades?\b/gi)) counts.add(match[1]!);
  for(const [pattern,count] of [[/\b(?:bi|two)[- ]?blades?\b/i,'2'],[/\b(?:tri|three)[- ]?blades?\b/i,'3'],[/\b(?:quad|four)[- ]?blades?\b/i,'4']] as const) if(pattern.test(text)) counts.add(count);
  return counts.size===1 ? [...counts] : [];
}
const facets: Partial<Record<Category, Facet[]>> = {
  frame:[field('frameInches','Frame size (inches)'),field('mount','Motor mounting')],
  motors:[field('motorKv','Motor KV'),field('motorSize','Motor size')],
  flightController:[field('connector','ESC connector'),field('fcCameraVideoInterfaces','Camera interface')],
  esc:[field('escAmps','Current rating (A)'),field('escInput','FC connector')],
  propellers:[{key:'blades',label:'Blade count',values:propellerBladeCount},field('propInches','Diameter (inches)')],
  battery:[field('voltage','Cell count (S)'),field('batteryMah','Capacity (mAh)'),field('batteryChemistry','Chemistry')],
  camera:[field('cameraVideoInterface','Video interface'),field('cameraWidthMm','Width (mm)')],
  receiver:[field('receiverProtocol','Protocol'),field('receiverSignalInterface','Signal interface')],
  videoTransmitter:[field('videoTransmitterSystem','Video system'),field('vtxAntennaConnector','Antenna connector')],
  gps:[field('deviceSignalInterface','Signal interface')],
  buzzer:[field('deviceMinVoltageV','Minimum voltage (V)')],
  antenna:[field('antennaConnector','Connector')],
  powerAccessory:[field('deviceMinVoltageV','Minimum voltage (V)')],
  optionalModule:[field('deviceSignalInterface','Signal interface')],
  radioTransmitter:[field('radioProtocols','Radio protocol')],
  fpvGoggles:[field('supportedVideoSystems','Video system')],
  batteryCharger:[field('chargerBatteryChemistries','Battery chemistry'),field('chargerConnectors','Connector')],
  chargingAccessory:[field('chargingConnectors','Connector')],
};
const valuesFor = (facet: Facet, product: Product) => {
  const values=facet.values(product);return values.length ? values : [UNKNOWN_FILTER_VALUE];
};
export function componentFilterMetadata(category: Category, products: readonly Product[]) {
  const categoryProducts=products.filter(p=>p.category===category);
  const prices=categoryProducts.map(p=>p.price).filter(p=>Number.isFinite(p)&&p>0);
  return {
    min: prices.length ? Math.min(...prices) : 0,
    max: prices.length ? Math.max(...prices) : 0,
    manufacturers:[...new Set(categoryProducts.map(p=>p.manufacturer?.trim()||UNKNOWN_FILTER_VALUE))].sort((a,b)=>a.localeCompare(b)),
    facets:(facets[category]??[]).map(f=>({...f,options:[...new Set(categoryProducts.flatMap(p=>valuesFor(f,p)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))})),
  };
}
export function filterComponentProducts(products: readonly Product[], category: Category, search: string, filters: ComponentFilters,
  isIncompatible: (p: Product)=>boolean, previewIds: ReadonlySet<string> = product3DPreviewIds) {
  const terms=search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return products.filter(p=>p.category===category && (!filters.price || p.price>=filters.price[0] && p.price<=filters.price[1]) &&
    (!filters.manufacturer || (p.manufacturer?.trim()||UNKNOWN_FILTER_VALUE)===filters.manufacturer) &&
    (!filters.preview3D || previewIds.has(p.id)) &&
    (!filters.compatible || !isIncompatible(p)) &&
    terms.every(term=>[p.name,p.manufacturer,p.model,p.manufacturerSku,p.variant].some(v=>v?.toLocaleLowerCase().includes(term))) &&
    (facets[category]??[]).every(f=>!filters.attributes[f.key] || valuesFor(f,p).includes(filters.attributes[f.key]!)));
}
export function mergeComponentEvidence(a: CatalogueEvidenceSnapshot, b: CatalogueEvidenceSnapshot): CatalogueEvidenceSnapshot {
  const unique=<T>(rows: T[])=>[...new Map(rows.map(row=>[JSON.stringify(row),row])).values()];
  return {fields:unique([...a.fields,...b.fields]),motorPropeller:unique([...a.motorPropeller,...b.motorPropeller]),motorEscCurrent:unique([...a.motorEscCurrent,...b.motorEscCurrent]),fcEscConnection:unique([...a.fcEscConnection,...b.fcEscConnection])};
}
export async function loadAllComponentOptions(readPage: (page: number)=>Promise<{status:string;products:Product[];evidence:CatalogueEvidenceSnapshot;hasMore:boolean}>, active:()=>boolean) {
  const products=new Map<string,Product>();
  let evidence: CatalogueEvidenceSnapshot={fields:[],motorPropeller:[],motorEscCurrent:[],fcEscConnection:[]};
  for(let page=1;page<=100000;page++) {
    const result=await readPage(page);
    if(!active()) return null;
    if(result.status!=='ready') throw new Error('Component catalogue unavailable');
    for(const product of result.products) products.set(product.id,product);
    evidence=mergeComponentEvidence(evidence,result.evidence);
    if(!result.hasMore) return {products:[...products.values()],evidence};
  }
  throw new Error('Component pagination did not finish');
}
