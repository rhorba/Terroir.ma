-- =============================================================================
-- Terroir.ma Database Initialization
-- Run automatically by postgis/postgis image on first start.
-- Creates PostGIS extensions, 4 domain schemas, grants, and search_path.
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "postgis_topology";

-- ── Domain Schemas (one per bounded context) ─────────────────────────────────

-- Cooperative registration, members, farm parcels
CREATE SCHEMA IF NOT EXISTS cooperative;

-- Product types, harvests, production batches, and lab test submissions
CREATE SCHEMA IF NOT EXISTS product;

-- Certification workflow: requests, inspections, decisions, QR codes, export docs
CREATE SCHEMA IF NOT EXISTS certification;

-- Notifications: templates, delivery logs, user preferences
CREATE SCHEMA IF NOT EXISTS notification;

-- ── Grant Privileges to App User ─────────────────────────────────────────────
GRANT ALL PRIVILEGES ON SCHEMA cooperative    TO terroir;
GRANT ALL PRIVILEGES ON SCHEMA product        TO terroir;
GRANT ALL PRIVILEGES ON SCHEMA certification  TO terroir;
GRANT ALL PRIVILEGES ON SCHEMA notification   TO terroir;

-- Allow future tables created in these schemas to be accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA cooperative    GRANT ALL ON TABLES    TO terroir;
ALTER DEFAULT PRIVILEGES IN SCHEMA cooperative    GRANT ALL ON SEQUENCES TO terroir;
ALTER DEFAULT PRIVILEGES IN SCHEMA product        GRANT ALL ON TABLES    TO terroir;
ALTER DEFAULT PRIVILEGES IN SCHEMA product        GRANT ALL ON SEQUENCES TO terroir;
ALTER DEFAULT PRIVILEGES IN SCHEMA certification  GRANT ALL ON TABLES    TO terroir;
ALTER DEFAULT PRIVILEGES IN SCHEMA certification  GRANT ALL ON SEQUENCES TO terroir;
ALTER DEFAULT PRIVILEGES IN SCHEMA notification   GRANT ALL ON TABLES    TO terroir;
ALTER DEFAULT PRIVILEGES IN SCHEMA notification   GRANT ALL ON SEQUENCES TO terroir;

-- ── Search Path ───────────────────────────────────────────────────────────────
-- TypeORM entities use unqualified names; this ensures they resolve correctly.
ALTER DATABASE terroir_db SET search_path TO public, cooperative, product, certification, notification;

-- ── Schema Documentation ──────────────────────────────────────────────────────
COMMENT ON SCHEMA cooperative   IS 'Cooperative registration, members, and farm management';
COMMENT ON SCHEMA product       IS 'Product types, harvests, production batches, and lab tests';
COMMENT ON SCHEMA certification IS 'Certification workflow, inspections, QR codes, and export documents';
COMMENT ON SCHEMA notification  IS 'Notifications, templates, and delivery logs';
