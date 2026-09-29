import {allCategoryIds,products,type BuildSelection,type Category,type Product} from "./build-data";
export interface ProductCatalogueService{getAllProducts():readonly Product[];getProductsByCategory(category:Category):readonly Product[];getProductById(id:string):Product|undefined;getProductsByIds(ids:readonly string[]):Product[]}
class StaticProductCatalogueService implements ProductCatalogueService{
  private readonly allProducts:readonly Product[];private readonly productsById:ReadonlyMap<string,Product>;private readonly productsByCategory:ReadonlyMap<Category,readonly Product[]>;
  constructor(sourceProducts:readonly Product[]){this.allProducts=[...sourceProducts];this.productsById=new Map(sourceProducts.map((product)=>[product.id,product]));this.productsByCategory=new Map(allCategoryIds.map((category)=>[category,sourceProducts.filter((product)=>product.category===category)]));}
  getAllProducts(){return this.allProducts} getProductsByCategory(category:Category){return this.productsByCategory.get(category)??[]} getProductById(id:string){return this.productsById.get(id)}
  getProductsByIds(ids:readonly string[]){return ids.flatMap((id)=>{const product=this.getProductById(id);return product?[product]:[]})}
}
export function createProductCatalogue(sourceProducts:readonly Product[]):ProductCatalogueService{return new StaticProductCatalogueService(sourceProducts)}
export const productCatalogue:ProductCatalogueService=createProductCatalogue(products);
export function resolveBuildSelection(selection:BuildSelection,catalogue:ProductCatalogueService=productCatalogue):Partial<Record<Category,Product>>{
  return Object.fromEntries(allCategoryIds.map((category)=>{const id=selection[category];return [category,id?catalogue.getProductById(id):undefined]})) as Partial<Record<Category,Product>>;
}
export function normalizeBuildSelection(selection:BuildSelection,catalogue:ProductCatalogueService=productCatalogue):BuildSelection{
  const normalized:BuildSelection={};for(const category of allCategoryIds){const id=selection[category];if(!id)continue;const product=catalogue.getProductById(id);if(product?.category===category)normalized[category]=id}return normalized;
}
const legacyMatchFields:Partial<Record<Category,readonly (keyof Product)[]>>={
  frame:["frameInches","mount"],motors:["motorSize","mount","minVoltage","maxVoltage"],flightController:["minVoltage","maxVoltage","connector"],esc:["minVoltage","maxVoltage","escAmps","escInput"],propellers:["propInches"],battery:["voltage","batteryMah"],camera:["video","cameraVideoInterface","cameraMinVoltageV","cameraMaxVoltageV"],receiver:["receiverProtocol","receiverSignalInterface","receiverFrequencyMinMhz","receiverFrequencyMaxMhz"],
};
function normalizedText(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"")}
function fieldSimilarity(expected:unknown,actual:unknown):number|null{
  if(expected===undefined||actual===undefined||expected===null||actual===null)return null;
  if(typeof expected==="number"&&typeof actual==="number"){const scale=Math.max(Math.abs(expected),Math.abs(actual),1);return Math.max(0,1-Math.abs(expected-actual)/scale)}
  if(typeof expected==="string"&&typeof actual==="string")return normalizedText(expected)===normalizedText(actual)?1:0;
  if(Array.isArray(expected)&&Array.isArray(actual)){const wanted=expected.map(String).map(normalizedText),found=new Set(actual.map(String).map(normalizedText));return wanted.length?wanted.filter((item)=>found.has(item)).length/wanted.length:null}
  return Object.is(expected,actual)?1:0;
}
function replacementScore(legacy:Product,candidate:Product):number|null{
  if(legacy.category!==candidate.category)return null;const fields=legacyMatchFields[legacy.category]??[];let compared=0,total=0;for(const field of fields){const score=fieldSimilarity(legacy[field],candidate[field]);if(score===null)continue;compared+=1;total+=score}return compared?total/compared:null;
}
function findSemanticLegacyReplacement(requestedId:string,category:Category,catalogue:ProductCatalogueService){
  const legacy=productCatalogue.getProductById(requestedId);if(!legacy||legacy.category!==category)return undefined;
  const ranked=catalogue.getProductsByCategory(category).flatMap((candidate)=>{const score=replacementScore(legacy,candidate);return score===null?[]:[{candidate,score}]}).sort((a,b)=>b.score-a.score||a.candidate.id.localeCompare(b.candidate.id));
  const best=ranked[0];return best&&best.score>=0.5?best.candidate:undefined;
}
export function rebaseBuildSelectionToCatalogue(selection:BuildSelection,catalogue:ProductCatalogueService):BuildSelection{
  const rebased:BuildSelection={};for(const category of allCategoryIds){const requestedId=selection[category];if(!requestedId)continue;const requested=catalogue.getProductById(requestedId);if(requested?.category===category){rebased[category]=requestedId;continue}const replacement=findSemanticLegacyReplacement(requestedId,category,catalogue);if(replacement)rebased[category]=replacement.id}return rebased;
}
