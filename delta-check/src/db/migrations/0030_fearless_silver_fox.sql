CREATE TABLE "insurer_deductible_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"partial_default" text NOT NULL,
	"total_loss_default" text NOT NULL,
	"partial_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"partial_parts" jsonb,
	"total_loss_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "insurer_deductible_profiles" ADD CONSTRAINT "insurer_deductible_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurer_deductible_profiles" ADD CONSTRAINT "insurer_deductible_profiles_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "insurer_deductible_profiles_org_insurer_idx" ON "insurer_deductible_profiles" USING btree ("organization_id","insurer_id");