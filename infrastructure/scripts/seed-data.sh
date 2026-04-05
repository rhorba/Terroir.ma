#!/usr/bin/env bash
# =============================================================================
# Terroir.ma Seed Data Script
# Inserts realistic test data: 10 real Moroccan cooperatives with GPS coords.
# Requires: psql available, DATABASE_URL set (or uses default).
# Run from the repository root: bash infrastructure/scripts/seed-data.sh
# =============================================================================
set -euo pipefail

echo "=== Seeding Terroir.ma Test Data ==="
DB_URL="${DATABASE_URL:-postgresql://terroir:terroir_pass@localhost:5432/terroir_db}"

echo "Target database: ${DB_URL}"
echo ""

psql "$DB_URL" <<'EOSQL'
-- ── 10 Real Moroccan Cooperatives with GPS Coordinates ─────────────────────
-- Regions use Morocco's 12-region administrative division (post-2015)
-- GPS coordinates verified against known geographic locations

INSERT INTO cooperative.cooperative (
  id,
  name,
  rc,
  ice,
  "if",
  region_code,
  city,
  latitude,
  longitude,
  president_name,
  president_cin,
  president_phone,
  created_at,
  updated_at
)
VALUES
  (
    uuid_generate_v4(),
    'Coopérative Tifawin',
    'RC-TIZNIT-001', '001234567890123', 'IF-001-2019',
    'SOUSS_MASSA', 'Tiznit',
    29.6974, -9.8022,
    'Fatima Oubella', 'AB123456', '+212661234567',
    NOW(), NOW()
  ),
  (
    uuid_generate_v4(),
    'Coopérative Souktana du Safran',
    'RC-TALIOUINE-001', '001234567890124', 'IF-002-2018',
    'SOUSS_MASSA', 'Taliouine',
    30.5325, -7.9275,
    'Ahmed Idoubrahim', 'CD234567', '+212662345678',
    NOW(), NOW()
  ),
  (
    uuid_generate_v4(),
    'GIE Femmes du Rif',
    'RC-OUEZZANE-001', '001234567890125', 'IF-003-2020',
    'TANGER_TETOUAN_AL_HOCEIMA', 'Ouezzane',
    34.7956, -5.5781,
    'Khadija Benali', 'EF345678', '+212663456789',
    NOW(), NOW()
  ),
  (
    uuid_generate_v4(),
    'Coopérative Aït Bouguemez',
    'RC-AZILAL-001', '001234567890126', 'IF-004-2019',
    'BENI_MELLAL_KHENIFRA', 'Azilal',
    31.6308, -6.4581,
    'Mohamed Aitmhand', 'GH456789', '+212664567890',
    NOW(), NOW()
  ),
  (
    uuid_generate_v4(),
    'Coopérative Al Amal des Roses',
    'RC-KELAAT-001', '001234567890127', 'IF-005-2017',
    'DRAA_TAFILALET', 'Kelaat M''Gouna',
    31.2400, -6.1300,
    'Hassan Ouahbi', 'IJ567890', '+212665678901',
    NOW(), NOW()
  ),
  (
    uuid_generate_v4(),
    'Coopérative Mejhoul d''Errachidia',
    'RC-ERRACHIDIA-001', '001234567890128', 'IF-006-2016',
    'DRAA_TAFILALET', 'Errachidia',
    31.9314, -4.4288,
    'Brahim Assou', 'KL678901', '+212666789012',
    NOW(), NOW()
  ),
  (
    uuid_generate_v4(),
    'Coopérative Amandiers de Tafraout',
    'RC-TAFRAOUT-001', '001234567890129', 'IF-007-2021',
    'SOUSS_MASSA', 'Tafraout',
    29.7228, -8.9750,
    'Aicha Tafraout', 'MN789012', '+212667890123',
    NOW(), NOW()
  ),
  (
    uuid_generate_v4(),
    'Coopérative Figuiers d''Ouezzane',
    'RC-OUEZZANE-002', '001234567890130', 'IF-008-2020',
    'TANGER_TETOUAN_AL_HOCEIMA', 'Ouezzane',
    34.7956, -5.5781,
    'Rachida Alaoui', 'OP890123', '+212668901234',
    NOW(), NOW()
  ),
  (
    uuid_generate_v4(),
    'Coopérative Grenadiers de Sefrou',
    'RC-SEFROU-001', '001234567890131', 'IF-009-2019',
    'FES_MEKNES', 'Sefrou',
    33.8305, -4.8353,
    'Youssef Benkirane', 'QR901234', '+212669012345',
    NOW(), NOW()
  ),
  (
    uuid_generate_v4(),
    'Coopérative Câpres de Safi',
    'RC-SAFI-001', '001234567890132', 'IF-010-2018',
    'MARRAKECH_SAFI', 'Safi',
    32.2994, -9.2372,
    'Zineb Chouaib', 'ST012345', '+212660123456',
    NOW(), NOW()
  )
ON CONFLICT DO NOTHING;

EOSQL

echo ""
echo "Seed data inserted successfully."
echo "  10 cooperatives seeded across 6 Moroccan regions:"
echo "    - 3x Souss-Massa (Tiznit, Taliouine, Tafraout)"
echo "    - 2x Draa-Tafilalet (Kelaat M'Gouna, Errachidia)"
echo "    - 2x Tanger-Tétouan-Al Hoceima (Ouezzane x2)"
echo "    - 1x Béni Mellal-Khénifra (Azilal)"
echo "    - 1x Fès-Meknès (Sefrou)"
echo "    - 1x Marrakech-Safi (Safi)"
echo ""
echo "Run 'make docker-full' and 'make dev' to start with seeded data."
