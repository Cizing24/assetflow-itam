\set ON_ERROR_STOP on
\getenv demo_runtime_password DEMO_RUNTIME_PASSWORD
SELECT current_database() = 'assetflow_demo' AND length(:'demo_runtime_password') >= 24 AS safe_target \gset
\if :safe_target
\else
  \echo Refused: requires assetflow_demo and a runtime password of at least 24 characters.
  \quit 3
\endif
CREATE ROLE assetflow_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :'demo_runtime_password';
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE assetflow_demo TO assetflow_runtime;
GRANT USAGE ON SCHEMA public TO assetflow_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO assetflow_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO assetflow_runtime;
REVOKE ALL ON TABLE "_prisma_migrations" FROM assetflow_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE "AuditLog" FROM assetflow_runtime;
