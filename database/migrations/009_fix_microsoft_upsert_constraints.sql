create unique index if not exists email_connections_organization_provider_unique
on public.email_connections (organization_id, provider);

create unique index if not exists integration_settings_organization_provider_unique
on public.integration_settings (organization_id, provider);
