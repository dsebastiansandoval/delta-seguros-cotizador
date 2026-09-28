CREATE TABLE "quote_executives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "executive" text;--> statement-breakpoint
ALTER TABLE "quote_executives" ADD CONSTRAINT "quote_executives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_executives_org_name_idx" ON "quote_executives" USING btree ("organization_id","name");