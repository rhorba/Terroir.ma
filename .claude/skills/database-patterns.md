---
name: database-patterns
description: Database conventions for Terroir.ma. Single PostgreSQL database with 4 schemas, TypeORM entities with UUIDs, JSONB for variable data, PostGIS for GPS, migrations workflow, indexing strategy, no cross-schema joins.
---

# Database Patterns — Terroir.ma

## Schema Architecture
Single PostgreSQL 16 database `terroir_db` with 4 schemas:
- `cooperative` — Cooperative, Member, Farm entities
- `product` — Product, ProductType, Harvest, ProductionBatch, LabTest, LabTestResult
- `certification` — Certification, Inspection, InspectionReport, QRCode, ExportDocument
- `notification` — Notification, NotificationTemplate, NotificationLog

## Standard Entity Template
```typescript
import { Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column, DeleteDateColumn } from 'typeorm';

@Entity({ schema: 'cooperative', name: 'cooperative' })
export class Cooperative {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string; // Keycloak user UUID

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null; // Soft delete
}
```

## JSONB for Variable Data
Lab test parameters vary by product type (argan has different params than saffron):
```typescript
@Column({ type: 'jsonb', name: 'test_values' })
testValues: Record<string, number | string>; // { acidity: 0.6, peroxideIndex: 12.3 }

@Column({ type: 'jsonb', name: 'parameter_definitions' })
parameterDefinitions: Array<{
  name: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
}>;
```

## PostGIS for Farm GPS
```typescript
import { Column } from 'typeorm';

@Column({
  type: 'geography',
  spatialFeatureType: 'Point',
  srid: 4326,
  nullable: true,
  name: 'location',
})
location: string | null; // WKT: 'POINT(-9.8022 29.6974)'
```

## TypeORM Migration Workflow
```bash
# 1. Generate migration after entity changes
npm run migration:generate -- src/migrations/AddFarmLocation

# 2. Review the generated file
cat src/migrations/*-AddFarmLocation.ts

# 3. Run migration
npm run migration:run

# 4. Never use synchronize: true in production
```

## Naming Conventions
- Table names: singular, snake_case (e.g., `cooperative`, `production_batch`)
- Column names: snake_case (e.g., `created_at`, `ice_number`)
- Indexes: `idx_<table>_<column>` (e.g., `idx_cooperative_ice`)
- Foreign keys: `fk_<table>_<reference>` (e.g., `fk_member_cooperative_id`)

## Indexing Strategy
- B-tree index on all foreign keys (automatic in TypeORM with @JoinColumn)
- GiST index on PostGIS geography columns:
  ```sql
  CREATE INDEX idx_farm_location ON product.farm USING GIST(location);
  ```
- B-tree index on frequently queried columns: certification_number, ice_number, qr_code_uuid

## No Cross-Schema Joins
```sql
-- FORBIDDEN: Join across schemas
SELECT c.name, p.name FROM cooperative.cooperative c
JOIN product.product p ON p.cooperative_id = c.id; -- NEVER!

-- CORRECT: Each module queries its own schema only
-- Product module stores cooperative_id as UUID, not a foreign key
```
