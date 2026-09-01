CREATE TYPE "public"."auth_provider" AS ENUM('microsoft', 'google', 'email');--> statement-breakpoint
CREATE TYPE "public"."branch" AS ENUM('AUTOS', 'SALUD');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('REPORTADO', 'APROBADO', 'REPARADO');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('PENDIENTE', 'COMISIONADA');--> statement-breakpoint
CREATE TYPE "public"."coverage_value_type" AS ENUM('BOOLEAN', 'AMOUNT', 'TEXT');--> statement-breakpoint
CREATE TYPE "public"."deductible_kind" AS ENUM('PARCIAL', 'TOTAL_DANO', 'TOTAL_ROBO');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('CEDULA', 'RUC', 'PASAPORTE');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MASCULINO', 'FEMENINO');--> statement-breakpoint
CREATE TYPE "public"."insured_relation" AS ENUM('TITULAR', 'DEPENDIENTE');--> statement-breakpoint
CREATE TYPE "public"."integration_mode" AS ENUM('MANUAL', 'API');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('SOFTSEGUROS');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('PENDIENTE', 'EMITIDA', 'NO_EMITIDA');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_status" AS ENUM('VIGENTE', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('ANUAL', 'POR_KM');--> statement-breakpoint
CREATE TYPE "public"."operation_type" AS ENUM('NUEVA', 'RENOVACION');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CONTADO', 'TARJETA');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDIENTE', 'PAGADO');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('NATURAL', 'JURIDICA');--> statement-breakpoint
CREATE TYPE "public"."quote_source" AS ENUM('MANUAL', 'API');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('BORRADOR', 'ENVIADA', 'ACEPTADA', 'VENCIDA');--> statement-breakpoint
CREATE TYPE "public"."rate_table_visibility" AS ENUM('PRIVATE', 'TEMPLATE');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('SIERRA', 'COSTA', 'AUSTRO');--> statement-breakpoint
CREATE TYPE "public"."role_code" AS ENUM('PLATFORM_ADMIN', 'ADMIN', 'SUPERVISOR', 'AGENTE', 'LECTOR');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(63) NOT NULL,
	"logo_url" text,
	"brand_primary_color" varchar(7),
	"brand_secondary_color" varchar(7),
	"plan" text DEFAULT 'standard' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"credentials" jsonb,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "role_code" NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_account_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"person_type" "person_type" NOT NULL,
	"document_type" "document_type" NOT NULL,
	"document_number" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"business_name" text,
	"email" text,
	"phone" text,
	"source" text,
	"assigned_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insured_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"region" "region" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insured_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"relation" "insured_relation" NOT NULL,
	"age" integer NOT NULL,
	"gender" "gender" NOT NULL,
	"birth_date" date
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"plate" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"body_type" text NOT NULL,
	"color" text,
	"chassis" text,
	"commercial_value_cents" bigint NOT NULL,
	"extras_value_cents" bigint DEFAULT 0 NOT NULL,
	"has_tracker" boolean DEFAULT false NOT NULL,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"branch" "branch" NOT NULL,
	"value_type" "coverage_value_type" NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "coverages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "deductible_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"kind" "deductible_kind" NOT NULL,
	"percent_of_loss" numeric(5, 2),
	"percent_of_insured_value" numeric(5, 2),
	"min_amount_cents" bigint,
	"requires_tracker" boolean DEFAULT false NOT NULL,
	"text_label" text
);
--> statement-breakpoint
CREATE TABLE "insurer_coverages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"coverage_id" uuid NOT NULL,
	"granted" boolean NOT NULL,
	"amount_cents" bigint,
	"text_value" text,
	"valid_from" date NOT NULL,
	"valid_to" date
);
--> statement-breakpoint
CREATE TABLE "insurers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"branch" "branch" NOT NULL,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"integration_mode" "integration_mode" DEFAULT 'MANUAL' NOT NULL,
	CONSTRAINT "insurers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rate_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_table_id" uuid NOT NULL,
	"vehicle_year_min" integer,
	"vehicle_year_max" integer,
	"value_min_cents" bigint,
	"value_max_cents" bigint,
	"body_type" text,
	"usage_type" text,
	"rate_percent" numeric(7, 5) NOT NULL,
	"min_premium_cents" bigint,
	"emission_fee_cents" bigint
);
--> statement-breakpoint
CREATE TABLE "rate_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"branch" "branch" NOT NULL,
	"visibility" "rate_table_visibility" DEFAULT 'PRIVATE' NOT NULL,
	"cloned_from_id" uuid,
	"is_confirmed" boolean DEFAULT true NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "payment_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_option_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"installments" integer,
	"has_interest" boolean DEFAULT false NOT NULL,
	"installment_amount_cents" bigint
);
--> statement-breakpoint
CREATE TABLE "quote_option_coverages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_option_id" uuid NOT NULL,
	"coverage_id" uuid NOT NULL,
	"granted" boolean NOT NULL,
	"amount_cents" bigint,
	"text_value" text
);
--> statement-breakpoint
CREATE TABLE "quote_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_risk_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"modality" "modality" DEFAULT 'ANUAL' NOT NULL,
	"net_premium_cents" bigint,
	"super_bancos_cents" bigint,
	"campesino_cents" bigint,
	"emission_fee_cents" bigint,
	"iva_cents" bigint,
	"total_premium_cents" bigint,
	"rate_percent_applied" numeric(7, 5),
	"source" "quote_source" DEFAULT 'MANUAL' NOT NULL,
	"raw_response" jsonb,
	"quoted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"risk_number" integer NOT NULL,
	"vehicle_id" uuid,
	"insured_group_id" uuid,
	"insured_value_cents" bigint,
	"extras_value_cents" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"client_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"branch" "branch" NOT NULL,
	"operation_type" "operation_type" NOT NULL,
	"status" "quote_status" DEFAULT 'BORRADOR' NOT NULL,
	"previous_insurer_id" uuid,
	"previous_policy_number" text,
	"previous_expiry_date" date,
	"valid_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"claim_number" text,
	"status" "claim_status" DEFAULT 'REPORTADO' NOT NULL,
	"occurred_at" date,
	"reported_at" date,
	"description" text,
	"deductible_applied_cents" bigint
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"base_amount_cents" bigint NOT NULL,
	"percent" numeric(5, 2),
	"amount_cents" bigint,
	"status" "commission_status" DEFAULT 'PENDIENTE' NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_option_id" uuid NOT NULL,
	"policy_number" text,
	"insurer_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"branch" "branch" NOT NULL,
	"issue_status" "issue_status" DEFAULT 'PENDIENTE' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDIENTE' NOT NULL,
	"lifecycle_status" "lifecycle_status" DEFAULT 'VIGENTE' NOT NULL,
	"inspection_required" boolean DEFAULT false NOT NULL,
	"starts_at" date,
	"ends_at" date,
	"premium_cents" bigint,
	"external_id" text,
	"is_void" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"ip_address" "inet",
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"client_id" uuid,
	"policy_version" text NOT NULL,
	"terms_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" "inet",
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insured_groups" ADD CONSTRAINT "insured_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insured_groups" ADD CONSTRAINT "insured_groups_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insured_members" ADD CONSTRAINT "insured_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insured_members" ADD CONSTRAINT "insured_members_group_id_insured_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."insured_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deductible_rules" ADD CONSTRAINT "deductible_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deductible_rules" ADD CONSTRAINT "deductible_rules_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurer_coverages" ADD CONSTRAINT "insurer_coverages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurer_coverages" ADD CONSTRAINT "insurer_coverages_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurer_coverages" ADD CONSTRAINT "insurer_coverages_coverage_id_coverages_id_fk" FOREIGN KEY ("coverage_id") REFERENCES "public"."coverages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_rules" ADD CONSTRAINT "rate_rules_rate_table_id_rate_tables_id_fk" FOREIGN KEY ("rate_table_id") REFERENCES "public"."rate_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_tables" ADD CONSTRAINT "rate_tables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_tables" ADD CONSTRAINT "rate_tables_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_options" ADD CONSTRAINT "payment_options_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_options" ADD CONSTRAINT "payment_options_quote_option_id_quote_options_id_fk" FOREIGN KEY ("quote_option_id") REFERENCES "public"."quote_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_option_coverages" ADD CONSTRAINT "quote_option_coverages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_option_coverages" ADD CONSTRAINT "quote_option_coverages_quote_option_id_quote_options_id_fk" FOREIGN KEY ("quote_option_id") REFERENCES "public"."quote_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_option_coverages" ADD CONSTRAINT "quote_option_coverages_coverage_id_coverages_id_fk" FOREIGN KEY ("coverage_id") REFERENCES "public"."coverages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_quote_risk_id_quote_risks_id_fk" FOREIGN KEY ("quote_risk_id") REFERENCES "public"."quote_risks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_risks" ADD CONSTRAINT "quote_risks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_risks" ADD CONSTRAINT "quote_risks_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_risks" ADD CONSTRAINT "quote_risks_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_risks" ADD CONSTRAINT "quote_risks_insured_group_id_insured_groups_id_fk" FOREIGN KEY ("insured_group_id") REFERENCES "public"."insured_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_previous_insurer_id_insurers_id_fk" FOREIGN KEY ("previous_insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_quote_option_id_quote_options_id_fk" FOREIGN KEY ("quote_option_id") REFERENCES "public"."quote_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policies" ADD CONSTRAINT "policies_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_events" ADD CONSTRAINT "policy_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_events" ADD CONSTRAINT "policy_events_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_events" ADD CONSTRAINT "policy_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;