-- Per-project WPScan API token.
--
-- Tech SEO > WordPress Security previously had one token for the whole
-- install, read from WPSCAN_API_TOKEN. That does not work for agencies: the
-- free WPScan tier is 25 requests a day and is licensed for non-commercial
-- use, so each client site realistically needs its own token and its own
-- quota. This column holds that token for one project.
--
-- The value is written by functions/_lib/wpscan-token.js, which encrypts it
-- with AES-256-GCM when GBP_TOKEN_ENCRYPTION_KEY is configured. An encrypted
-- value is self-identifying: it starts with the literal "v1.". Anything else
-- is a plaintext token stored on an install with no encryption key set.
--
-- 512 chars leaves ample room for the ~43-char tokens WPScan issues today plus
-- the ~60 bytes of base64 IV and GCM tag that encryption adds.

ALTER TABLE user_projects
  ADD COLUMN site_token VARCHAR(512) NULL AFTER project_data;
