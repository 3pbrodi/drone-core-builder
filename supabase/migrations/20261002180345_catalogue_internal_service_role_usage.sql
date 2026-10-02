-- Grant only the importer role access to resolve existing private catalogue helpers.
-- No CREATE, PUBLIC, anon, authenticated, function, or table privileges are added.
grant usage on schema catalogue_internal to service_role;
