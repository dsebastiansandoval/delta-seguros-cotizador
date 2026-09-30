CREATE TABLE "health_plan_coverages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insurer_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"section" text NOT NULL,
	"label" text NOT NULL,
	"display_order" integer NOT NULL,
	"copago" text,
	"sublimite" text,
	"carencia" text
);
--> statement-breakpoint
ALTER TABLE "health_plan_coverages" ADD CONSTRAINT "health_plan_coverages_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE no action ON UPDATE no action;