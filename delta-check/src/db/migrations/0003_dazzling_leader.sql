CREATE TABLE "policy_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"due_date" date,
	"amount_cents" bigint NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "workshop" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "advisor_name" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "has_third_party_liability" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "third_party_plate" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "claim_value_cents" bigint;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "third_party_value_cents" bigint;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "invoice_number" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "annex_number" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "cancelled_at" date;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "policy_installments" ADD CONSTRAINT "policy_installments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_installments" ADD CONSTRAINT "policy_installments_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE no action ON UPDATE no action;