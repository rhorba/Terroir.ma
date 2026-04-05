# SDOQ Products — Morocco's Recognized Terroir Products

## Overview

Morocco has 37+ products recognized or in-process under the SDOQ framework (Law 25-06). The platform supports all of them as `productTypeCode` values.

## Registered Products

| Product | French Name | Type | Region | SDOQ Status | Notes |
|---------|-------------|------|--------|-------------|-------|
| Huile d'Argan | Arganeraie | AOP | Souss-Massa | Registered (2009) | First Moroccan AOP; UNESCO Biosphere Reserve |
| Safran de Taliouine | — | IGP | Souss-Massa (Taliouine) | Registered | Highest crocin content globally |
| Huile d'Olive Picholine Marocaine | — | AOP | Multi-region | Registered | Picholine Marocaine cultivar only |
| Clémentine de Berkane | — | IGP | Oriental (Berkane) | Registered | Seedless, thin rind |
| Dattes Medjoul de Tafilalet | — | AOP | Drâa-Tafilalet | Registered | "King of Dates" |
| Rose de Dades | — | IGP | Drâa-Tafilalet (Vallée des Roses) | Registered | Rosa damascena; 3,500 tons/year |
| Miel d'Euphorbe de Jebli | — | IGP | Tanger-Tétouan | Registered | Euphorbia resinifera nectar |
| Thuya de Berbérie | — | IGP | Tanger-Tétouan | Registered | Tetraclinis articulata wood |
| Cumin de Chichaoua | — | IGP | Marrakech-Safi | Registered | |
| Poulpe de la Côte Atlantique | — | IGP | Atlantic coast | Registered | Octopus vulgaris |
| Fromage de Chèvre Jbel Bani | — | LA | Guelmim | In progress | |
| Argan cosmétique | — | AOP | Souss-Massa | In progress | Separate from food argan |
| Figue de Taounate | — | IGP | Fès-Meknès | In progress | |
| Grenade Sefri de Tighanimine | — | IGP | Béni Mellal-Khénifra | In progress | |
| Pêche de Meknès | — | IGP | Fès-Meknès | In progress | |
| Cerise de Sefrou | — | IGP | Fès-Meknès | In progress | |
| Olive Picholine de Meknès | — | IGP | Fès-Meknès | Registered | Table olive (distinct from oil) |
| Huile d'Olive Menara | — | IGP | Marrakech-Safi | Registered | |

## Product Type Codes in Platform

```
ARGAN_OIL          → AOP/IGP — Souss-Massa
SAFFRON            → AOP/IGP — Souss-Massa (Taliouine)
OLIVE_OIL_PICHOLINE → AOP   — Multi-region
HONEY_EUPHORBIA    → IGP    — Tanger-Tétouan
MEDJOOL_DATES      → AOP/IGP — Drâa-Tafilalet
ROSE_DADES         → IGP    — Drâa-Tafilalet
CLEMENTINE_BERKANE → IGP    — Oriental
THUYA_WOOD         → IGP    — Tanger-Tétouan
```

## Adding a New Product Type

1. Add entry to `shared/constants/terroir-product-types.json`
2. Add lab parameters to `shared/constants/lab-test-parameters.json`
3. Create a new TypeORM migration to seed the product type in the database
4. Update Swagger documentation
