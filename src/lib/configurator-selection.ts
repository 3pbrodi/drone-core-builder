import {categoryMetadata,coreRequiredCategoryIds,optionalCategoryIds,pilotGearCategoryIds,type Category,type ConfiguratorSection} from "./component-categories";
import type {Product} from "./build-data";

export type SelectedProductMap = Partial<Record<Category,Product>>;

function claimsCategory(product:Product,category:Category){
  return product.category===category || product.integratedCategories?.includes(category)===true || product.includedCategories?.includes(category)===true;
}
export function fulfillmentProductForCategory(selected:SelectedProductMap,category:Category):Product|undefined{
  return Object.values(selected).find((product):product is Product=>Boolean(product)&&claimsCategory(product,category));
}
export function requiredCategoriesForSelection(selected:SelectedProductMap):Category[]{
  return coreRequiredCategoryIds.filter((category)=>{
    if(selected[category]) return true;
    if(!categoryMetadata[category].canBeFulfilledByIntegration) return true;
    return !fulfillmentProductForCategory(selected,category);
  });
}
export function optionalCategoriesForSelection(selected:SelectedProductMap):Category[]{
  return optionalCategoryIds.filter((category)=>{
    if(selected[category]) return true;
    return !(categoryMetadata[category].canBeFulfilledByIntegration && fulfillmentProductForCategory(selected,category));
  });
}
export function sectionCategoriesForSelection(section:ConfiguratorSection,selected:SelectedProductMap):Category[]{
  if(section==="required") return requiredCategoriesForSelection(selected);
  if(section==="optional") return optionalCategoriesForSelection(selected);
  return [...pilotGearCategoryIds];
}
export function integratedRequiredFulfillments(selected:SelectedProductMap){
  return coreRequiredCategoryIds.flatMap((category)=>{
    if(selected[category]) return [];
    const product=fulfillmentProductForCategory(selected,category);
    return product?[{category,product}]:[];
  });
}
export function selectionPriceSummary(selected:SelectedProductMap){
  let drone=0,pilotGear=0;
  for(const product of Object.values(selected)){
    if(!product) continue;
    if(categoryMetadata[product.category].installationRole==="pilot") pilotGear+=product.price;
    else drone+=product.price;
  }
  return {drone,pilotGear,overall:drone+pilotGear};
}
