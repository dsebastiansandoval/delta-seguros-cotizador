CREATE TABLE "vehicle_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_brand_id_vehicle_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."vehicle_brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_models_brand_name_idx" ON "vehicle_models" USING btree ("brand_id","name");