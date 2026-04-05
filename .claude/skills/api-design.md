---
name: api-design
description: REST API design rules for Terroir.ma. Standard response envelope, URL patterns, pagination, error codes, DTO validation, OpenAPI decorators, authentication requirements, rate limiting.
---

# API Design — Terroir.ma

## URL Pattern
`/api/v1/<module>/<resource>`
Examples:
- GET `/api/v1/cooperatives` — list cooperatives
- POST `/api/v1/cooperatives` — register cooperative
- GET `/api/v1/cooperatives/:id/members` — list members
- POST `/api/v1/products/:id/harvests` — log harvest
- POST `/api/v1/certifications/request` — request certification
- GET `/api/v1/verify/:uuid` — public QR verification (no auth required)

## Standard Response Envelope
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;    // e.g., COOPERATIVE_NOT_FOUND
    message: string; // Human-readable
    details?: unknown;
  } | null;
  meta: {
    page?: number;
    limit?: number;
    total?: number;
    correlationId: string;
  };
}
```

## Error Code Taxonomy
- COOPERATIVE_NOT_FOUND, COOPERATIVE_ALREADY_EXISTS, COOPERATIVE_SUSPENDED
- MEMBER_NOT_FOUND, MEMBER_DUPLICATE_CIN
- HARVEST_INVALID_DATE, HARVEST_CAMPAIGN_MISMATCH
- LAB_TEST_NOT_FOUND, LAB_TEST_FAILED, LAB_TEST_PARAM_OUT_OF_RANGE
- CERTIFICATION_NOT_FOUND, CERTIFICATION_ALREADY_PENDING, CERTIFICATION_REVOKED
- INSPECTION_SCHEDULE_CONFLICT, INSPECTION_REPORT_INCOMPLETE
- QR_CODE_INVALID_SIGNATURE, QR_CODE_EXPIRED, QR_CODE_NOT_FOUND
- EXPORT_DOC_INCOMPLETE, EXPORT_INVALID_HS_CODE
- VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, INTERNAL_ERROR

## Pagination
- Offset-based for admin lists: `?page=1&limit=20`
- Cursor-based for event feeds: `?cursor=<last-id>&limit=20`

## DTO Validation with class-validator
```typescript
import { IsString, IsEmail, Matches, Length } from 'class-validator';

export class CreateCooperativeDto {
  @IsString()
  @Length(3, 100)
  name: string;

  @Matches(/^\d{15}$/, { message: 'ICE must be exactly 15 digits' })
  ice: string;

  @IsEmail()
  email: string;
}
```

## OpenAPI Decorators on All Endpoints
```typescript
@ApiTags('cooperatives')
@ApiBearerAuth()
@ApiOperation({ summary: 'Register a new cooperative' })
@ApiResponse({ status: 201, description: 'Cooperative registered', type: CooperativeResponseDto })
@ApiResponse({ status: 400, description: 'Validation error' })
@ApiResponse({ status: 409, description: 'Cooperative already exists' })
```

## Authentication Rules
- ALL endpoints require Bearer JWT EXCEPT:
  - GET /health
  - GET /ready
  - GET /api/v1/verify/:uuid (public QR verification)
- Role-based with @Roles guard on all write operations

## Rate Limiting
- Default: 100 requests / 15 minutes per IP
- Auth endpoints: 10 requests / 15 minutes
- QR verification: 1000 requests / 15 minutes (cached via Redis)
