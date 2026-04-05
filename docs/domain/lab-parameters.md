# Lab Analysis Parameters

This document defines the required laboratory analysis parameters for each SDOQ product type supported by the Terroir.ma platform. Parameter thresholds are specified per the applicable SDOQ product specification (cahier des charges) and relevant international standards.

All parameter definitions are mirrored in the configuration file `lab-test-parameters.json`, which the platform reads at runtime to evaluate whether a batch's lab results meet specification.

---

## General Notes

- **Threshold evaluation**: A batch passes lab analysis only if ALL parameters fall within their defined thresholds simultaneously.
- **Units**: All units are those in which the lab reports the measurement. The platform does not perform unit conversion — labs must report in the specified units.
- **Lab accreditation**: All analyses must be performed by an ONSSA-accredited laboratory. The `labId` recorded on the `LabTestSubmission` is validated against the accredited lab register at submission time.
- **Standards references**: Where an international standard (ISO, IOC, AOAC) applies, it is noted in the "Standard" column. SDOQ specifications reference these standards for method selection.

---

## Argan Oil (Huile d'Argan)

**Certification type**: AOP — Arganeraie region (Souss-Massa / Agadir hinterland)

**SDOQ specification reference**: Cahier des charges — Huile d'Argan (MAPMDREF, 2009)

| Parameter | Unit | Min | Max | Standard |
|-----------|------|-----|-----|----------|
| Acidity (as oleic acid) | % | — | 4.0 | IOC/T.20/Doc.7 |
| Peroxide value | meq O₂/kg | — | 20 | IOC/T.20/Doc.35 |
| Moisture and volatile matter | % | — | 0.2 | ISO 662 |
| Oleic acid (C18:1) | % of total fatty acids | 43.0 | 49.9 | ISO 5508 / GC-FID |
| Tocopherols (total) | mg/kg | 600 | 900 | HPLC (ISO 9936) |

**Notes:**
- Acidity above 4.0% is grounds for automatic lab failure.
- Oleic acid content is a key authenticity marker for argan oil. Values outside the 43–49.9% range may indicate adulteration.
- Tocopherol content distinguishes argan oil from other vegetable oils; the 600–900 mg/kg range is characteristic of genuine argan oil.

---

## Saffron (Safran de Taliouine)

**Certification type**: IGP — Taliouine / Taznakht area (Souss-Massa / Drâa-Tafilalet)

**SDOQ specification reference**: Cahier des charges — Safran de Taliouine (MAPMDREF)

**Primary standard**: ISO 3632 (Saffron — Specifications and test methods)

| Parameter | Unit | Min | Max | Standard |
|-----------|------|-----|-----|----------|
| Crocin (colour strength, E1%¹cm at 440 nm) | E1% | 190 | — | ISO 3632-2 |
| Safranal (aroma, E1%¹cm at 330 nm) | E1% | 20 | 50 | ISO 3632-2 |
| Picrocrocin (bitterness, E1%¹cm at 257 nm) | E1% | 70 | — | ISO 3632-2 |
| Moisture | % | — | 12.0 | ISO 3632-2 |
| Ash (total) | % | — | 8.0 | ISO 3632-2 |

**ISO 3632 Category Mapping:**

| ISO Category | Crocin (E1%) | Picrocrocin (E1%) | Safranal (E1%) |
|--------------|-------------|-------------------|----------------|
| Category I (highest) | ≥ 190 | ≥ 85 | 20–50 |
| Category II | ≥ 150 | ≥ 70 | 20–50 |
| Category III | ≥ 110 | ≥ 65 | 20–50 |

The SDOQ specification for Safran de Taliouine requires **Category I** equivalence (crocin ≥ 190, picrocrocin ≥ 70, safranal 20–50).

**Notes:**
- Crocin is measured by UV-Vis spectrophotometry at 440 nm.
- Safranal range has both a minimum (20) and maximum (50) — excessively high safranal can indicate improper drying.

---

## Olive Oil Picholine Marocaine

**Certification type**: AOP — Multiple regions (Meknès, Marrakech-Safi, Fès-Meknès)

**SDOQ specification reference**: Cahier des charges — Huile d'Olive Picholine Marocaine (MAPMDREF)

**Primary standard**: EU Reg. 2568/91 (as referenced by IOC standards); IOC/T.20 series

| Parameter | Unit | Min | Max | Standard |
|-----------|------|-----|-----|----------|
| Acidity (free fatty acids, as oleic acid) | % | — | 0.8 | IOC/T.20/Doc.7 |
| Peroxide value | meq O₂/kg | — | 20 | IOC/T.20/Doc.35 |
| Polyphenols (total) | mg/kg | 100 | — | Folin-Ciocalteu / IOC |
| Specific extinction K232 | — | — | 2.50 | IOC/T.20/Doc.19 |
| Specific extinction K270 | — | — | 0.22 | IOC/T.20/Doc.19 |

**Notes:**
- Acidity ≤ 0.8% is the criterion for extra-virgin classification.
- Polyphenol content (minimum 100 mg/kg) is a health-linked quality marker; Picholine Marocaine is noted for relatively high polyphenol content.
- K232 and K270 are ultraviolet absorbance readings used to detect oxidation and adulteration.

---

## Honey (Miel d'Euphorbe de Jebli)

**Certification type**: IGP — Tanger-Tétouan-Al Hoceïma region

**SDOQ specification reference**: Cahier des charges — Miel d'Euphorbe de Jebli (MAPMDREF)

**Primary standard**: EU Directive 2001/110/EC (honey); AOAC methods

| Parameter | Unit | Min | Max | Standard |
|-----------|------|-----|-----|----------|
| Moisture | % | — | 20.0 | Refractometry (AOAC 969.38) |
| Hydroxymethylfurfural (HMF) | mg/kg | — | 40 | HPLC or Winkler method |
| Diastase activity | Schade units | 8 | — | Phadebas method |
| Sucrose | % | — | 5.0 | HPLC (AOAC 977.20) |
| Fructose + Glucose (combined) | % | 60.0 | — | HPLC |

**Notes:**
- Moisture above 20% indicates risk of fermentation; this is a critical failure criterion.
- HMF increases with storage age and heat exposure. Fresh honey typically shows HMF below 10 mg/kg; the 40 mg/kg threshold is the regulatory maximum.
- Diastase activity below 8 Schade units indicates over-heating during processing or old honey.
- Sucrose above 5% may indicate adulteration with sugar syrup.
- Euphorbia honey (Miel d'Euphorbe) has distinctive organoleptic properties; pollen analysis may be required alongside chemical parameters for full SDOQ compliance.

---

## Medjoul Dates (Dattes Medjoul de Tafilalet)

**Certification type**: AOP — Drâa-Tafilalet region (Erfoud, Errachidia, Zagora)

**SDOQ specification reference**: Cahier des charges — Dattes Medjoul de Tafilalet (MAPMDREF)

| Parameter | Unit | Min | Max | Standard |
|-----------|------|-----|-----|----------|
| Moisture | % | — | 25.0 | AOAC 934.06 |
| Total sugars | % of dry weight | 55.0 | — | HPLC / Lane-Eynon |
| Flesh-to-seed (pit) ratio | ratio (by weight) | 9.0 | — | Physical measurement |
| Average fruit weight | g / fruit | 18.0 | — | Physical measurement (sample of 10) |

**Notes:**
- Moisture above 25% shortens shelf life and may permit microbial growth; it is a critical failure criterion.
- The flesh-to-seed ratio of ≥ 9.0 (i.e., at least 9 parts flesh for every 1 part seed) is a defining characteristic of the Medjoul variety.
- Average weight of ≥ 18 g per fruit distinguishes Medjoul from smaller date varieties; this is measured on a representative sample of 10 fruits from the batch.
- Sugar content confirms fruit maturity at harvest; under-ripe dates will fail the 55% minimum.

---

## Dades Rose (Rose de Dades)

**Certification type**: IGP — Drâa-Tafilalet (Vallée des Roses, Kelâat M'Gouna / Boumalne Dadès)

**SDOQ specification reference**: Cahier des charges — Rose de Dades (MAPMDREF)

**Primary standard**: GC-MS (Gas Chromatography–Mass Spectrometry) for essential oil composition

| Parameter | Unit | Min | Max | Standard |
|-----------|------|-----|-----|----------|
| Geraniol | % of essential oil | 10.0 | — | GC-MS (ISO 11024) |
| Citronellol | % of essential oil | 18.0 | — | GC-MS (ISO 11024) |
| Nonadecane | presence | present | — | GC-MS (marker compound) |
| Moisture (dried petals) | % | — | 12.0 | ISO 954 |

**Notes:**
- The GC-MS profile of Rosa damascena from the Dades valley has a characteristic fingerprint. Geraniol and citronellol are the principal components of authentic Dades rose essential oil.
- Nonadecane is a hydrocarbon marker compound whose presence is characteristic of Rosa damascena; its absence may indicate adulteration or substitution with Rosa canina.
- The moisture threshold of 12% applies to dried petals or concentrated products. Fresh petal batches are subject to moisture analysis of the derived distillate.
- Citronellol minimum of 18% is higher than many other rose varieties, supporting the geographic authenticity claim of the IGP.

---

## Parameter Configuration Reference

The canonical machine-readable version of these parameters is maintained in:

```
src/product/config/lab-test-parameters.json
```

Each product type entry in that file follows this structure:

```json
{
  "productType": "argan-oil",
  "parameters": [
    {
      "key": "acidity",
      "label_fr": "Acidité (acide oléique)",
      "unit": "%",
      "min": null,
      "max": 4.0,
      "required": true,
      "standard": "IOC/T.20/Doc.7"
    }
  ]
}
```

Any changes to thresholds must be made in both this document (for human reference) and `lab-test-parameters.json` (for runtime evaluation). A mismatch between the two is a documentation bug and should be resolved promptly.
