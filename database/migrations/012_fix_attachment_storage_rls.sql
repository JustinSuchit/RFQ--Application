alter table public.email_attachments enable row level security;

drop policy if exists "Org members can select email_attachments" on public.email_attachments;
create policy "Org members can select email_attachments"
on public.email_attachments for select
using (public.is_org_member(organization_id));

drop policy if exists "Org members can insert email_attachments" on public.email_attachments;
create policy "Org members can insert email_attachments"
on public.email_attachments for insert
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can update email_attachments" on public.email_attachments;
create policy "Org members can update email_attachments"
on public.email_attachments for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Org members can delete email_attachments" on public.email_attachments;
create policy "Org members can delete email_attachments"
on public.email_attachments for delete
using (public.is_org_member(organization_id));

drop policy if exists "Org members can select rfq email attachment objects" on storage.objects;
create policy "Org members can select rfq email attachment objects"
on storage.objects for select
using (
  bucket_id = 'rfq-email-attachments'
  and (storage.foldername(name))[1] = 'organizations'
  and public.is_org_member(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "Org members can insert rfq email attachment objects" on storage.objects;
create policy "Org members can insert rfq email attachment objects"
on storage.objects for insert
with check (
  bucket_id = 'rfq-email-attachments'
  and (storage.foldername(name))[1] = 'organizations'
  and public.is_org_member(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "Org members can update rfq email attachment objects" on storage.objects;
create policy "Org members can update rfq email attachment objects"
on storage.objects for update
using (
  bucket_id = 'rfq-email-attachments'
  and (storage.foldername(name))[1] = 'organizations'
  and public.is_org_member(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'rfq-email-attachments'
  and (storage.foldername(name))[1] = 'organizations'
  and public.is_org_member(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "Org members can delete rfq email attachment objects" on storage.objects;
create policy "Org members can delete rfq email attachment objects"
on storage.objects for delete
using (
  bucket_id = 'rfq-email-attachments'
  and (storage.foldername(name))[1] = 'organizations'
  and public.is_org_member(((storage.foldername(name))[2])::uuid)
);
