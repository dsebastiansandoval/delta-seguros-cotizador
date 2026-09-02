CREATE TABLE "health_rate_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rate_table_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"age_min" integer NOT NULL,
	"age_max" integer NOT NULL,
	"gender" "gender",
	"region" "region",
	"deductible_code" text,
	"premium_cents" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_options" ADD COLUMN "plan_code" text;--> statement-breakpoint
ALTER TABLE "health_rate_rules" ADD CONSTRAINT "health_rate_rules_rate_table_id_rate_tables_id_fk" FOREIGN KEY ("rate_table_id") REFERENCES "public"."rate_tables"("id") ON DELETE no action ON UPDATE no action;