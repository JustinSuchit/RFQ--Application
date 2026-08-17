-- ============================================================
-- P0 role-aware RLS policies
-- Replaces broad member-write policies with tested RBAC rules.
-- ============================================================

-- RFQs: members read, procurement writes, owner/admin deletes.
drop policy if exists "Org members can select rfqs" on public.rfqs;
drop policy if exists "Org members can insert rfqs" on public.rfqs;
drop policy if exists "Org members can update rfqs" on public.rfqs;
drop policy if exists "Org members can delete rfqs" on public.rfqs;
drop policy if exists "P0 procurement can insert rfqs" on public.rfqs;
drop policy if exists "P0 procurement can update rfqs" on public.rfqs;
drop policy if exists "P0 owner admin can delete rfqs" on public.rfqs;
create policy "Org members can select rfqs" on public.rfqs for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert rfqs" on public.rfqs for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update rfqs" on public.rfqs for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 owner admin can delete rfqs" on public.rfqs for delete using (public.can_manage_organization(organization_id));

-- RFQ items: members read, procurement writes.
drop policy if exists "Org members can select rfq_items" on public.rfq_items;
drop policy if exists "Org members can insert rfq_items" on public.rfq_items;
drop policy if exists "Org members can update rfq_items" on public.rfq_items;
drop policy if exists "Org members can delete rfq_items" on public.rfq_items;
drop policy if exists "P0 procurement can insert rfq_items" on public.rfq_items;
drop policy if exists "P0 procurement can update rfq_items" on public.rfq_items;
drop policy if exists "P0 procurement can delete rfq_items" on public.rfq_items;
create policy "Org members can select rfq_items" on public.rfq_items for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert rfq_items" on public.rfq_items for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update rfq_items" on public.rfq_items for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can delete rfq_items" on public.rfq_items for delete using (public.can_manage_procurement(organization_id));

-- Attachment extracted items: members read, procurement writes.
drop policy if exists "Org members can select attachment_extracted_items" on public.attachment_extracted_items;
drop policy if exists "Org members can insert attachment_extracted_items" on public.attachment_extracted_items;
drop policy if exists "Org members can update attachment_extracted_items" on public.attachment_extracted_items;
drop policy if exists "Org members can delete attachment_extracted_items" on public.attachment_extracted_items;
drop policy if exists "P0 procurement can insert attachment_extracted_items" on public.attachment_extracted_items;
drop policy if exists "P0 procurement can update attachment_extracted_items" on public.attachment_extracted_items;
drop policy if exists "P0 procurement can delete attachment_extracted_items" on public.attachment_extracted_items;
create policy "Org members can select attachment_extracted_items" on public.attachment_extracted_items for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert attachment_extracted_items" on public.attachment_extracted_items for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update attachment_extracted_items" on public.attachment_extracted_items for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can delete attachment_extracted_items" on public.attachment_extracted_items for delete using (public.can_manage_procurement(organization_id));

-- Customers and suppliers: members read, procurement CRUD.
drop policy if exists "Org members can select customers" on public.customers;
drop policy if exists "Org members can insert customers" on public.customers;
drop policy if exists "Org members can update customers" on public.customers;
drop policy if exists "Org members can delete customers" on public.customers;
drop policy if exists "P0 procurement can insert customers" on public.customers;
drop policy if exists "P0 procurement can update customers" on public.customers;
drop policy if exists "P0 procurement can delete customers" on public.customers;
create policy "Org members can select customers" on public.customers for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert customers" on public.customers for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update customers" on public.customers for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can delete customers" on public.customers for delete using (public.can_manage_procurement(organization_id));

drop policy if exists "Org members can select suppliers" on public.suppliers;
drop policy if exists "Org members can insert suppliers" on public.suppliers;
drop policy if exists "Org members can update suppliers" on public.suppliers;
drop policy if exists "Org members can delete suppliers" on public.suppliers;
drop policy if exists "P0 procurement can insert suppliers" on public.suppliers;
drop policy if exists "P0 procurement can update suppliers" on public.suppliers;
drop policy if exists "P0 procurement can delete suppliers" on public.suppliers;
create policy "Org members can select suppliers" on public.suppliers for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert suppliers" on public.suppliers for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update suppliers" on public.suppliers for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can delete suppliers" on public.suppliers for delete using (public.can_manage_procurement(organization_id));

-- Supplier quotes and items: members read, procurement CRUD.
drop policy if exists "Org members can select supplier_quotes" on public.supplier_quotes;
drop policy if exists "Org members can insert supplier_quotes" on public.supplier_quotes;
drop policy if exists "Org members can update supplier_quotes" on public.supplier_quotes;
drop policy if exists "Org members can delete supplier_quotes" on public.supplier_quotes;
drop policy if exists "P0 procurement can insert supplier_quotes" on public.supplier_quotes;
drop policy if exists "P0 procurement can update supplier_quotes" on public.supplier_quotes;
drop policy if exists "P0 procurement can delete supplier_quotes" on public.supplier_quotes;
create policy "Org members can select supplier_quotes" on public.supplier_quotes for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert supplier_quotes" on public.supplier_quotes for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update supplier_quotes" on public.supplier_quotes for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can delete supplier_quotes" on public.supplier_quotes for delete using (public.can_manage_procurement(organization_id));

drop policy if exists "Org members can select supplier_quote_items" on public.supplier_quote_items;
drop policy if exists "Org members can insert supplier_quote_items" on public.supplier_quote_items;
drop policy if exists "Org members can update supplier_quote_items" on public.supplier_quote_items;
drop policy if exists "Org members can delete supplier_quote_items" on public.supplier_quote_items;
drop policy if exists "P0 procurement can insert supplier_quote_items" on public.supplier_quote_items;
drop policy if exists "P0 procurement can update supplier_quote_items" on public.supplier_quote_items;
drop policy if exists "P0 procurement can delete supplier_quote_items" on public.supplier_quote_items;
create policy "Org members can select supplier_quote_items" on public.supplier_quote_items for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert supplier_quote_items" on public.supplier_quote_items for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update supplier_quote_items" on public.supplier_quote_items for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can delete supplier_quote_items" on public.supplier_quote_items for delete using (public.can_manage_procurement(organization_id));

-- Customer quotes: members read, procurement insert/update, owner/admin delete.
drop policy if exists "Org members can select customer_quotes" on public.customer_quotes;
drop policy if exists "Org members can insert customer_quotes" on public.customer_quotes;
drop policy if exists "Org members can update customer_quotes" on public.customer_quotes;
drop policy if exists "Org members can delete customer_quotes" on public.customer_quotes;
drop policy if exists "P0 procurement can insert customer_quotes" on public.customer_quotes;
drop policy if exists "P0 procurement can update customer_quotes" on public.customer_quotes;
drop policy if exists "P0 owner admin can delete customer_quotes" on public.customer_quotes;
create policy "Org members can select customer_quotes" on public.customer_quotes for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert customer_quotes" on public.customer_quotes for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update customer_quotes" on public.customer_quotes for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 owner admin can delete customer_quotes" on public.customer_quotes for delete using (public.can_manage_organization(organization_id));

-- Customer quote items: members read, procurement CRUD.
drop policy if exists "Org members can select customer_quote_items" on public.customer_quote_items;
drop policy if exists "Org members can insert customer_quote_items" on public.customer_quote_items;
drop policy if exists "Org members can update customer_quote_items" on public.customer_quote_items;
drop policy if exists "Org members can delete customer_quote_items" on public.customer_quote_items;
drop policy if exists "P0 procurement can insert customer_quote_items" on public.customer_quote_items;
drop policy if exists "P0 procurement can update customer_quote_items" on public.customer_quote_items;
drop policy if exists "P0 procurement can delete customer_quote_items" on public.customer_quote_items;
create policy "Org members can select customer_quote_items" on public.customer_quote_items for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert customer_quote_items" on public.customer_quote_items for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update customer_quote_items" on public.customer_quote_items for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can delete customer_quote_items" on public.customer_quote_items for delete using (public.can_manage_procurement(organization_id));

-- Email intake records: members read, procurement insert/update, owner/admin delete.
drop policy if exists "Org members can select email_messages" on public.email_messages;
drop policy if exists "Org members can insert email_messages" on public.email_messages;
drop policy if exists "Org members can update email_messages" on public.email_messages;
drop policy if exists "Org members can delete email_messages" on public.email_messages;
drop policy if exists "P0 procurement can insert email_messages" on public.email_messages;
drop policy if exists "P0 procurement can update email_messages" on public.email_messages;
drop policy if exists "P0 owner admin can delete email_messages" on public.email_messages;
create policy "Org members can select email_messages" on public.email_messages for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert email_messages" on public.email_messages for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update email_messages" on public.email_messages for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 owner admin can delete email_messages" on public.email_messages for delete using (public.can_manage_organization(organization_id));

drop policy if exists "Org members can select email_attachments" on public.email_attachments;
drop policy if exists "Org members can insert email_attachments" on public.email_attachments;
drop policy if exists "Org members can update email_attachments" on public.email_attachments;
drop policy if exists "Org members can delete email_attachments" on public.email_attachments;
drop policy if exists "P0 procurement can insert email_attachments" on public.email_attachments;
drop policy if exists "P0 procurement can update email_attachments" on public.email_attachments;
drop policy if exists "P0 owner admin can delete email_attachments" on public.email_attachments;
create policy "Org members can select email_attachments" on public.email_attachments for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert email_attachments" on public.email_attachments for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update email_attachments" on public.email_attachments for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));
create policy "P0 owner admin can delete email_attachments" on public.email_attachments for delete using (public.can_manage_organization(organization_id));

-- Email scan runs: no normal delete policy.
drop policy if exists "Org members can select email_scan_runs" on public.email_scan_runs;
drop policy if exists "Org members can insert email_scan_runs" on public.email_scan_runs;
drop policy if exists "Org members can update email_scan_runs" on public.email_scan_runs;
drop policy if exists "P0 procurement can insert email_scan_runs" on public.email_scan_runs;
drop policy if exists "P0 procurement can update email_scan_runs" on public.email_scan_runs;
create policy "Org members can select email_scan_runs" on public.email_scan_runs for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert email_scan_runs" on public.email_scan_runs for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 procurement can update email_scan_runs" on public.email_scan_runs for update using (public.can_manage_procurement(organization_id)) with check (public.can_manage_procurement(organization_id));

-- Organization configuration/integrations: owner/admin writes.
drop policy if exists "Org members can select email_connections" on public.email_connections;
drop policy if exists "Org members can insert email_connections" on public.email_connections;
drop policy if exists "Org members can update email_connections" on public.email_connections;
drop policy if exists "Org members can delete email_connections" on public.email_connections;
drop policy if exists "P0 owner admin can insert email_connections" on public.email_connections;
drop policy if exists "P0 owner admin can update email_connections" on public.email_connections;
drop policy if exists "P0 owner admin can delete email_connections" on public.email_connections;
create policy "Org members can select email_connections" on public.email_connections for select using (public.is_org_member(organization_id));
create policy "P0 owner admin can insert email_connections" on public.email_connections for insert with check (public.can_manage_organization(organization_id));
create policy "P0 owner admin can update email_connections" on public.email_connections for update using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));
create policy "P0 owner admin can delete email_connections" on public.email_connections for delete using (public.can_manage_organization(organization_id));

drop policy if exists "Org members can select integration_settings" on public.integration_settings;
drop policy if exists "Org members can insert integration_settings" on public.integration_settings;
drop policy if exists "Org members can update integration_settings" on public.integration_settings;
drop policy if exists "Org members can delete integration_settings" on public.integration_settings;
drop policy if exists "P0 owner admin can insert integration_settings" on public.integration_settings;
drop policy if exists "P0 owner admin can update integration_settings" on public.integration_settings;
drop policy if exists "P0 owner admin can delete integration_settings" on public.integration_settings;
create policy "Org members can select integration_settings" on public.integration_settings for select using (public.is_org_member(organization_id));
create policy "P0 owner admin can insert integration_settings" on public.integration_settings for insert with check (public.can_manage_organization(organization_id));
create policy "P0 owner admin can update integration_settings" on public.integration_settings for update using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));
create policy "P0 owner admin can delete integration_settings" on public.integration_settings for delete using (public.can_manage_organization(organization_id));

drop policy if exists "Org members can select email_templates" on public.email_templates;
drop policy if exists "Org members can insert email_templates" on public.email_templates;
drop policy if exists "Org members can update email_templates" on public.email_templates;
drop policy if exists "Org members can delete email_templates" on public.email_templates;
drop policy if exists "P0 owner admin can insert email_templates" on public.email_templates;
drop policy if exists "P0 owner admin can update email_templates" on public.email_templates;
drop policy if exists "P0 owner admin can delete email_templates" on public.email_templates;
create policy "Org members can select email_templates" on public.email_templates for select using (public.is_org_member(organization_id));
create policy "P0 owner admin can insert email_templates" on public.email_templates for insert with check (public.can_manage_organization(organization_id));
create policy "P0 owner admin can update email_templates" on public.email_templates for update using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));
create policy "P0 owner admin can delete email_templates" on public.email_templates for delete using (public.can_manage_organization(organization_id));

-- Approval rules and requests.
drop policy if exists "Org members can select approval_rules" on public.approval_rules;
drop policy if exists "Org members can insert approval_rules" on public.approval_rules;
drop policy if exists "Org members can update approval_rules" on public.approval_rules;
drop policy if exists "Org members can delete approval_rules" on public.approval_rules;
drop policy if exists "P0 owner admin can insert approval_rules" on public.approval_rules;
drop policy if exists "P0 owner admin can update approval_rules" on public.approval_rules;
drop policy if exists "P0 owner admin can delete approval_rules" on public.approval_rules;
create policy "Org members can select approval_rules" on public.approval_rules for select using (public.is_org_member(organization_id));
create policy "P0 owner admin can insert approval_rules" on public.approval_rules for insert with check (public.can_manage_organization(organization_id));
create policy "P0 owner admin can update approval_rules" on public.approval_rules for update using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));
create policy "P0 owner admin can delete approval_rules" on public.approval_rules for delete using (public.can_manage_organization(organization_id));

drop policy if exists "Org members can select approval_requests" on public.approval_requests;
drop policy if exists "Org members can insert approval_requests" on public.approval_requests;
drop policy if exists "Org members can update approval_requests" on public.approval_requests;
drop policy if exists "Org members can delete approval_requests" on public.approval_requests;
drop policy if exists "P0 procurement can insert approval_requests" on public.approval_requests;
drop policy if exists "P0 owner admin can update approval_requests" on public.approval_requests;
drop policy if exists "P0 owner admin can delete approval_requests" on public.approval_requests;
create policy "Org members can select approval_requests" on public.approval_requests for select using (public.is_org_member(organization_id));
create policy "P0 procurement can insert approval_requests" on public.approval_requests for insert with check (public.can_manage_procurement(organization_id));
create policy "P0 owner admin can update approval_requests" on public.approval_requests for update using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));
create policy "P0 owner admin can delete approval_requests" on public.approval_requests for delete using (public.can_manage_organization(organization_id));
