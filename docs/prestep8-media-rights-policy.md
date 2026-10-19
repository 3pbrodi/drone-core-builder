# DroneCores – Media and picture reuse policy (draft, not yet owner-approved)

Date checked: 2026-10-19. Scope: first four proof-of-quality product candidates.

## Why we will not copy manufacturer/seller photographs automatically

A photo accessible on a manufacturer's website is not automatically licensed for redistribution in our FPV configurator. The CNHL published terms describe the site's pictures and documents as copyrighted; Rotorama's shop terms explicitly reserve the site's product imagery. HQProp product pages display an all-rights-reserved notice, and no written model-photo distribution grant to DroneCores was established for TBS or RCTech. No external photo has been copied or newly reused in this QA work.

**Sources:** 
- CNHL: https://chinahobbyline.com/pages/terms-and-conditions
- Rotorama: https://www.rotorama.de/obchodni-podminky
- HQProp: https://www.hqprop.com/ethix-p2-pickle-prop-2cw2ccw-poly-carbonate-p0459.html
- TBS: https://www.team-blacksheep.com/products/prod:crossfire_nano_se
- RCTech: https://www.rctech.de/tbs-lucid-60a-6s-4-in-1-esc

## Proposed clean-room image mode: use the app's existing neutral icon

The existing product thumbnail code in `src/components/BuildInterface.tsx` renders an `ImageOff` icon for products with no image URL. It does not need a manufacturer or seller photo or a new upload. Lucide provides `ImageOff` under its ISC license. Official license: https://lucide.dev/license. Retain the copyright / license notice in the bundled dependency's license notices and honor associated Feather MIT notices as applicable. Neutral icons are a generic UI indication and must not misrepresent the appearance or exact variant of a physical product.

For the four pilot candidates, keep `product.image`, `image_url`, `image_source_url`, license and verified-photo records empty. No broken placeholder URL or hidden third-party-image hotlink. An icon-only card may go live **only after explicit owner acceptance of this media policy** and all other product/offer/release approvals.

If the owner later needs real photos, require a written explicit permission grant from the actual rights holder to use the specific manufacturer/model images on DroneCores (including commercial redisplay/derivatives/CDN copy terms if relevant); record license text/date, source, rightsholder and reviewer in `catalogue_product_images` before including the image in the runtime. Third-party product photo download is blocked absent a license.

## Media review gates

- Manufacturer photo found **does not imply licensed**.
- `media_policy_approved=false` by default for all four source candidates.
- If `neutral_icon`, only the already licensed generic UI icon is used, with no third-party product image.
- If `licensed_image`, `license_name`, `license_url`, rights holder, exact-model proof and review are mandatory.
- Image availability is **not** identity or offer verification. These require their own separate reviewer sign-off.

**Current decision:** lawful generic-icon route technically **available** and supporting license identified; **owner's policy acceptance remains pending**, and no public product is authorized by this document.
