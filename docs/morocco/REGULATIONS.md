# Moroccan Regulatory Framework

## Primary Law — Law 25-06

**Full title**: Loi n° 25-06 relative aux signes distinctifs d'origine et de qualité des denrées alimentaires et des produits agricoles et halieutiques

**Enacted**: 2008 | **Implementing decree**: Decree 2-08-403

### Three SDOQ Signs

| Sign | French | Arabic | Scope |
|------|--------|--------|-------|
| AOP | Appellation d'Origine Protégée | تسمية المنشأ المحمية | All production, processing, elaboration in the defined geographic area |
| IGP | Indication Géographique Protégée | الإشارة الجغرافية المحمية | At least one step (production, processing, or elaboration) in the area |
| LA | Label Agricole | الملصق الفلاحي | Superior quality vs. comparable products; no geographic constraint |

### Certification Process (Law 25-06, Articles 7–22)

1. Application by a grouping of producers to MAPMDREF
2. Submission of *cahier des charges* (product specification)
3. Public inquiry (90 days)
4. Evaluation by the National Commission for SDOQ (CNSDOQ)
5. Ministerial approval by decree
6. Registration in the national register
7. Ongoing control by accredited certification body

---

## Related Laws and Regulations

### Law 28-07 — Food Safety
Governs food safety standards. ONSSA (Office National de Sécurité Sanitaire des Produits Alimentaires) is the implementing authority. Lab tests required by the platform reference ONSSA-accredited laboratory standards.

### Law 09-08 — Personal Data Protection (CNDP)
Governs processing of personal data. Terroir.ma processes CIN, phone numbers, and professional identities. See [cndp-compliance.md](cndp-compliance.md) for implementation details.

### Law 13-83 — Repression of Fraud
Criminalizes false labeling and fraudulent use of origin designations. The platform's HMAC-signed QR codes and immutable event chain provide evidence for fraud investigation.

### Decree 2-19-807 — Export of Agricultural Products
Governs export certification for SDOQ products. EACCE issues export certificates. The platform's ExportDocument entity maps to the EACCE export clearance workflow.

---

## Governing Bodies

| Body | Role | Platform Integration |
|------|------|---------------------|
| **MAPMDREF** | Ministry of Agriculture — issues SDOQ designations by decree | Data controller; oversight of certification body role |
| **ONSSA** | Food safety office — accredits labs, enforces food standards | Lab test parameters in `shared/constants/lab-test-parameters.json` |
| **EACCE** | Export control establishment — issues export certificates | `customs-agent` role; ExportDocument validation |
| **CNSDOQ** | National SDOQ Commission — advises MAPMDREF on new SDOQ applications | Outside platform scope (v1) |
| **CNDP** | Data protection authority | CNDP declaration required before go-live |

---

## Certification Number Alignment

The platform's certification number format `TERROIR-{AOP|IGP|LA}-{REGION_CODE}-{YEAR}-{SEQ}` is an internal reference number. The official SDOQ registration number issued by MAPMDREF is stored separately in the `Certification.officialReference` field (nullable, added when official registration is confirmed).

---

## Export HS Codes (Common SDOQ Products)

| Product | HS Code | Notes |
|---------|---------|-------|
| Argan oil (food) | 1515.30 | Edible fixed oils |
| Argan oil (cosmetic) | 3304.99 | Beauty/skincare |
| Saffron | 0910.20 | Spices |
| Olive oil (extra virgin) | 1509.10 | |
| Dates (fresh/dried) | 0804.10 | |
| Honey | 0409.00 | Natural honey |
| Rose water / essential oil | 3301.29 | Essential oils |
