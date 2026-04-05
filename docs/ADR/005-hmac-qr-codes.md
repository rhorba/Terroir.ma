# ADR-005: HMAC-SHA256 for QR Code Tamper Detection

Date: 2026-03-30

## Status

Accepted

## Context

Certified products carry QR codes that consumers scan to verify product authenticity. The QR code mechanism must satisfy:

- **Unforgeability:** A bad actor must not be able to generate a valid QR code for a product they do not own.
- **Fast verification:** The target latency for a consumer scan-to-result is < 200ms.
- **No external PKI dependency:** The system must not rely on a third-party certificate authority for the core verification path. PKI adds renewal complexity and external availability dependency.
- **Offline-capable signature verification:** The signature itself must be verifiable without a network call if a client caches the verification result.

Asymmetric signatures (RSA/ECDSA) were considered but introduce key management complexity (HSM, key rotation ceremonies) not justified for v1. HMAC-SHA256 with a platform-level secret satisfies the unforgeability requirement with simpler operational characteristics.

## Decision

Each certified product is assigned a UUID at certification grant time. A QR code encodes the following URL:

```
https://terroir.ma/verify/{uuid}?sig={hmac}
```

The HMAC-SHA256 signature is computed as:

```
HMAC-SHA256(
  key  = QR_HMAC_SECRET,
  data = "{uuid}:{certificationId}:{certificationNumber}"
)
```

The result is hex-encoded and included as the `sig` query parameter.

**Verification flow (`GET /verify/:uuid`):**

1. Look up the certification record by UUID from the Redis cache (TTL: 5 minutes).
2. If cache miss, fetch from the `certification` schema and populate the cache.
3. Recompute the expected HMAC using the stored `certificationId` and `certificationNumber`.
4. Compare the provided `sig` against the expected HMAC using a constant-time comparison (`crypto.timingSafeEqual`).
5. If valid, return the certification summary. If invalid, return HTTP 403.

**Secret management:** `QR_HMAC_SECRET` is a 256-bit random value stored in the platform secrets manager (environment variable in v1, Vault in Phase 2). It is never logged or included in error responses.

**Secret rotation:** Rotating `QR_HMAC_SECRET` invalidates all existing QR codes. Rotation procedure: deploy with both old and new secrets active simultaneously for a grace period of 30 days (verification accepts either), then remove the old secret. All existing QR code URLs remain valid during the grace period.

**Redis cache:** Certification data is cached under the key `qr:verify:{uuid}` with a 5-minute TTL. Cache invalidation is triggered via Kafka when a certification is revoked.

## Consequences

**Positive:**
- HMAC verification is computationally inexpensive; verification latency is dominated by Redis lookup (~1ms) rather than cryptography.
- No dependency on an external PKI or CA.
- Constant-time comparison prevents timing-based signature oracle attacks.
- Simple implementation using Node.js built-in `crypto` module.

**Negative / Risks:**
- **Secret rotation invalidates all QR codes:** Physical labels on products cannot be re-printed automatically. The grace period procedure mitigates this but requires operational discipline.
- **Symmetric secret:** Unlike asymmetric schemes, anyone with access to `QR_HMAC_SECRET` can forge valid QR codes. Access to this secret must be strictly controlled.
- **No offline verification without caching:** Consumers verifying without internet access can use a locally cached response, but cannot re-verify from the URL alone without the platform secret.
- Redis availability affects verification latency. Cache misses fall back to the database, increasing latency to ~20–50ms but remaining within the 200ms target.
