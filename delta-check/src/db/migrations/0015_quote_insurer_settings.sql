CREATE TYPE "public"."auto_coverage_type" AS ENUM('TODO_RIESGO', 'SOLO_PERDIDA_TOTAL');--> statement-breakpoint
CREATE TABLE "quote_insurer_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"coverage_type" "auto_coverage_type" DEFAULT 'TODO_RIESGO' NOT NULL,
	"amparo_patrimonial" boolean NOT NULL,
	"rc_amount_cents" bigint,
	"gm_amount_cents" bigint,
	"partial_deductible" text,
	"total_loss_deductible" text,
	"coverage_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_insurer_settings" ADD CONSTRAINT "quote_insurer_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_insurer_settings" ADD CONSTRAINT "quote_insurer_settings_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_insurer_settings" ADD CONSTRAINT "quote_insurer_settings_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_insurer_settings_quote_insurer_idx" ON "quote_insurer_settings" USING btree ("quote_id","insurer_id");