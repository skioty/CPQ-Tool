SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: check_platform_primary_contact(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_platform_primary_contact() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE target uuid;
BEGIN
  IF TG_TABLE_NAME = 'platform_tenants' THEN target := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN target := OLD.tenant_id;
  ELSE target := NEW.tenant_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_tenants WHERE id = target) AND
    (SELECT count(*) FROM public.platform_tenant_contacts WHERE tenant_id = target AND "primary") <> 1 THEN
    RAISE EXCEPTION 'Exactly one primary contact is required' USING ERRCODE = '23514', CONSTRAINT = 'platform_exactly_one_primary';
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: immutable_platform_schema_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.immutable_platform_schema_key() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.schema_key IS DISTINCT FROM OLD.schema_key THEN
    RAISE EXCEPTION 'Schema identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: lock_platform_contact_parent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_platform_contact_parent() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM id FROM public.platform_tenants WHERE id = OLD.tenant_id FOR UPDATE;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF TG_OP = 'UPDATE' AND NEW.tenant_id <> OLD.tenant_id THEN
      RAISE EXCEPTION 'Contact tenant cannot change' USING ERRCODE = '23514';
    END IF;
    PERFORM id FROM public.platform_tenants WHERE id = NEW.tenant_id FOR UPDATE;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ar_internal_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_internal_metadata (
    key character varying NOT NULL,
    value character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: platform_account_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_account_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id character varying NOT NULL,
    subject_id character varying NOT NULL,
    action character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: platform_administrators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_administrators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying NOT NULL,
    encrypted_password character varying NOT NULL,
    role character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    name character varying,
    activated_at timestamp(6) without time zone,
    totp_secret_ciphertext text,
    totp_last_used_at bigint,
    totp_failed_attempts integer DEFAULT 0 NOT NULL,
    totp_locked_until timestamp(6) without time zone,
    recovery_code_digests jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT platform_administrator_role CHECK (((role)::text = ANY (ARRAY[('super_admin'::character varying)::text, ('admin'::character varying)::text])))
);


--
-- Name: platform_brand_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_brand_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    owner_id character varying NOT NULL,
    kind character varying NOT NULL,
    content_type character varying NOT NULL,
    content bytea NOT NULL,
    storage_key character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: platform_external_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_external_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issuer character varying NOT NULL,
    subject character varying NOT NULL,
    account_scope character varying NOT NULL,
    account_id uuid NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT external_identity_scope CHECK (((account_scope)::text = ANY ((ARRAY['administrator'::character varying, 'tenant_user'::character varying])::text[])))
);


--
-- Name: platform_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind character varying NOT NULL,
    email character varying NOT NULL,
    token_digest character varying NOT NULL,
    tenant_id uuid,
    administrator_id uuid,
    invited_by_id uuid NOT NULL,
    delivery_status character varying DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    accepted_at timestamp(6) without time zone,
    revoked_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT invitation_delivery_status CHECK (((delivery_status)::text = ANY ((ARRAY['pending'::character varying, 'sent'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT invitation_target_kind CHECK (((((kind)::text = 'staff'::text) AND (administrator_id IS NOT NULL) AND (tenant_id IS NULL)) OR (((kind)::text = 'tenant'::text) AND (tenant_id IS NOT NULL) AND (administrator_id IS NULL))))
);


--
-- Name: platform_provisioning_failures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_provisioning_failures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    request_id character varying NOT NULL,
    error_code character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: platform_reference_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_reference_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind character varying NOT NULL,
    code character varying NOT NULL,
    label character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: platform_tenant_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_tenant_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    administrator_id character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: platform_tenant_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_tenant_audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_id character varying NOT NULL,
    action character varying NOT NULL,
    request_id character varying NOT NULL,
    changed_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: platform_tenant_brandings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_tenant_brandings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    primary_colour character varying,
    secondary_colour character varying,
    typography character varying,
    logo_attachment_id character varying,
    favicon_attachment_id character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: platform_tenant_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_tenant_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying,
    email character varying,
    "primary" boolean DEFAULT false NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    phone character varying
);


--
-- Name: platform_tenant_retention_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_tenant_retention_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_id character varying NOT NULL,
    action character varying NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: platform_tenant_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_tenant_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    currency character varying,
    fee numeric,
    payment_method character varying,
    discount_type character varying,
    discount_value numeric,
    discount_duration character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    payment_method_description text,
    first_invoiced_at timestamp(6) without time zone
);


--
-- Name: platform_tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name character varying,
    company_name_display boolean,
    description text,
    industry_id character varying,
    lifecycle_status character varying,
    provisioning_status character varying DEFAULT 'pending'::character varying NOT NULL,
    lock_version integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    schema_key character varying DEFAULT ('cpq_t_'::text || replace((gen_random_uuid())::text, '-'::text, ''::text)) NOT NULL,
    display_name character varying,
    country character varying,
    time_zone character varying,
    archived_at timestamp(6) without time zone,
    legal_hold boolean,
    billing_resolved boolean,
    contracts_resolved boolean,
    retention_records_approved boolean,
    retention_policy_reference character varying,
    CONSTRAINT platform_provisioning_status CHECK (((provisioning_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('ready'::character varying)::text]))),
    CONSTRAINT platform_schema_key_format CHECK (((schema_key)::text ~ '^cpq_t_[0-9a-f]{32}$'::text))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: tenant_access_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_access_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    role character varying DEFAULT 'tenant_admin'::character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT tenant_membership_role CHECK (((role)::text = 'tenant_admin'::text))
);


--
-- Name: tenant_access_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_access_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying NOT NULL,
    encrypted_password character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    totp_secret_ciphertext text,
    totp_last_used_at bigint,
    totp_failed_attempts integer DEFAULT 0 NOT NULL,
    totp_locked_until timestamp(6) without time zone,
    recovery_code_digests jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: platform_administrators administrator_id_text_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_administrators
    ADD CONSTRAINT administrator_id_text_unique UNIQUE (id);


--
-- Name: ar_internal_metadata ar_internal_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_internal_metadata
    ADD CONSTRAINT ar_internal_metadata_pkey PRIMARY KEY (key);


--
-- Name: platform_account_events platform_account_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_account_events
    ADD CONSTRAINT platform_account_events_pkey PRIMARY KEY (id);


--
-- Name: platform_administrators platform_administrators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_administrators
    ADD CONSTRAINT platform_administrators_pkey PRIMARY KEY (id);


--
-- Name: platform_brand_assets platform_brand_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_brand_assets
    ADD CONSTRAINT platform_brand_assets_pkey PRIMARY KEY (id);


--
-- Name: platform_external_identities platform_external_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_external_identities
    ADD CONSTRAINT platform_external_identities_pkey PRIMARY KEY (id);


--
-- Name: platform_invitations platform_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invitations
    ADD CONSTRAINT platform_invitations_pkey PRIMARY KEY (id);


--
-- Name: platform_provisioning_failures platform_provisioning_failures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_provisioning_failures
    ADD CONSTRAINT platform_provisioning_failures_pkey PRIMARY KEY (id);


--
-- Name: platform_reference_options platform_reference_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_reference_options
    ADD CONSTRAINT platform_reference_options_pkey PRIMARY KEY (id);


--
-- Name: platform_tenant_assignments platform_tenant_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_assignments
    ADD CONSTRAINT platform_tenant_assignments_pkey PRIMARY KEY (id);


--
-- Name: platform_tenant_audit_events platform_tenant_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_audit_events
    ADD CONSTRAINT platform_tenant_audit_events_pkey PRIMARY KEY (id);


--
-- Name: platform_tenant_brandings platform_tenant_brandings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_brandings
    ADD CONSTRAINT platform_tenant_brandings_pkey PRIMARY KEY (id);


--
-- Name: platform_tenant_contacts platform_tenant_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_contacts
    ADD CONSTRAINT platform_tenant_contacts_pkey PRIMARY KEY (id);


--
-- Name: platform_tenant_retention_events platform_tenant_retention_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_retention_events
    ADD CONSTRAINT platform_tenant_retention_events_pkey PRIMARY KEY (id);


--
-- Name: platform_tenant_subscriptions platform_tenant_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_subscriptions
    ADD CONSTRAINT platform_tenant_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: platform_tenants platform_tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenants
    ADD CONSTRAINT platform_tenants_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tenant_access_memberships tenant_access_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_access_memberships
    ADD CONSTRAINT tenant_access_memberships_pkey PRIMARY KEY (id);


--
-- Name: tenant_access_users tenant_access_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_access_users
    ADD CONSTRAINT tenant_access_users_pkey PRIMARY KEY (id);


--
-- Name: index_platform_invitations_on_tenant_id_and_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_platform_invitations_on_tenant_id_and_email ON public.platform_invitations USING btree (tenant_id, email);


--
-- Name: index_platform_invitations_on_token_digest; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_platform_invitations_on_token_digest ON public.platform_invitations USING btree (token_digest);


--
-- Name: index_platform_reference_options_on_kind_and_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_platform_reference_options_on_kind_and_code ON public.platform_reference_options USING btree (kind, code);


--
-- Name: index_platform_tenant_assignments_on_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_platform_tenant_assignments_on_tenant_id ON public.platform_tenant_assignments USING btree (tenant_id);


--
-- Name: index_platform_tenant_audit_events_on_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_platform_tenant_audit_events_on_tenant_id ON public.platform_tenant_audit_events USING btree (tenant_id);


--
-- Name: index_platform_tenant_brandings_on_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_platform_tenant_brandings_on_tenant_id ON public.platform_tenant_brandings USING btree (tenant_id);


--
-- Name: index_platform_tenant_contacts_on_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_platform_tenant_contacts_on_tenant_id ON public.platform_tenant_contacts USING btree (tenant_id);


--
-- Name: index_platform_tenant_retention_events_on_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_platform_tenant_retention_events_on_tenant_id ON public.platform_tenant_retention_events USING btree (tenant_id);


--
-- Name: index_platform_tenant_subscriptions_on_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_platform_tenant_subscriptions_on_tenant_id ON public.platform_tenant_subscriptions USING btree (tenant_id);


--
-- Name: index_platform_tenants_on_schema_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_platform_tenants_on_schema_key ON public.platform_tenants USING btree (schema_key);


--
-- Name: one_platform_primary_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_platform_primary_contact ON public.platform_tenant_contacts USING btree (tenant_id) WHERE ("primary" = true);


--
-- Name: unique_platform_account_external_identity; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_platform_account_external_identity ON public.platform_external_identities USING btree (account_scope, account_id);


--
-- Name: unique_platform_administrator_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_platform_administrator_email ON public.platform_administrators USING btree (lower((email)::text));


--
-- Name: unique_platform_external_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_platform_external_subject ON public.platform_external_identities USING btree (issuer, subject);


--
-- Name: unique_platform_tenant_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_platform_tenant_admin ON public.platform_tenant_assignments USING btree (tenant_id, administrator_id);


--
-- Name: unique_tenant_access_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_tenant_access_email ON public.tenant_access_users USING btree (lower((email)::text));


--
-- Name: unique_tenant_access_membership; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_tenant_access_membership ON public.tenant_access_memberships USING btree (user_id, tenant_id);


--
-- Name: platform_tenants immutable_platform_schema_key; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER immutable_platform_schema_key BEFORE UPDATE ON public.platform_tenants FOR EACH ROW EXECUTE FUNCTION public.immutable_platform_schema_key();


--
-- Name: platform_tenant_contacts lock_platform_contact_parent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lock_platform_contact_parent BEFORE INSERT OR DELETE OR UPDATE ON public.platform_tenant_contacts FOR EACH ROW EXECUTE FUNCTION public.lock_platform_contact_parent();


--
-- Name: platform_tenant_contacts platform_exactly_one_primary_contact; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER platform_exactly_one_primary_contact AFTER INSERT OR DELETE OR UPDATE ON public.platform_tenant_contacts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_platform_primary_contact();


--
-- Name: platform_tenants platform_exactly_one_primary_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER platform_exactly_one_primary_tenant AFTER INSERT OR UPDATE ON public.platform_tenants DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_platform_primary_contact();


--
-- Name: platform_tenant_brandings fk_rails_1058416fac; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_brandings
    ADD CONSTRAINT fk_rails_1058416fac FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id) ON DELETE RESTRICT;


--
-- Name: platform_tenant_audit_events fk_rails_109968650d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_audit_events
    ADD CONSTRAINT fk_rails_109968650d FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id) ON DELETE RESTRICT;


--
-- Name: platform_tenant_assignments fk_rails_3641e178ff; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_assignments
    ADD CONSTRAINT fk_rails_3641e178ff FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id) ON DELETE RESTRICT;


--
-- Name: platform_tenant_contacts fk_rails_3b5bfff3a3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_contacts
    ADD CONSTRAINT fk_rails_3b5bfff3a3 FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id) ON DELETE RESTRICT;


--
-- Name: platform_invitations fk_rails_721b56b164; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invitations
    ADD CONSTRAINT fk_rails_721b56b164 FOREIGN KEY (invited_by_id) REFERENCES public.platform_administrators(id);


--
-- Name: platform_tenant_subscriptions fk_rails_768a77920a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_tenant_subscriptions
    ADD CONSTRAINT fk_rails_768a77920a FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id) ON DELETE RESTRICT;


--
-- Name: platform_invitations fk_rails_8bd10f8e96; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invitations
    ADD CONSTRAINT fk_rails_8bd10f8e96 FOREIGN KEY (administrator_id) REFERENCES public.platform_administrators(id);


--
-- Name: tenant_access_memberships fk_rails_8f18afb2c6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_access_memberships
    ADD CONSTRAINT fk_rails_8f18afb2c6 FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id);


--
-- Name: platform_brand_assets fk_rails_bdb742c00c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_brand_assets
    ADD CONSTRAINT fk_rails_bdb742c00c FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id);


--
-- Name: tenant_access_memberships fk_rails_e4086e218d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_access_memberships
    ADD CONSTRAINT fk_rails_e4086e218d FOREIGN KEY (user_id) REFERENCES public.tenant_access_users(id);


--
-- Name: platform_invitations fk_rails_eedf51d672; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_invitations
    ADD CONSTRAINT fk_rails_eedf51d672 FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id);


--
-- PostgreSQL database dump complete
--

SET search_path TO "$user", public;

INSERT INTO "schema_migrations" (version) VALUES
('20261026000200'),
('20261026000100'),
('20261025000100'),
('20261023000100'),
('20261022000200'),
('20261022000100');
