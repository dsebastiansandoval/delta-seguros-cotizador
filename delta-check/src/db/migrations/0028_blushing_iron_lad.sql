ALTER TYPE "public"."claim_status" ADD VALUE 'ENTREGADO';--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "vehicle_plate" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "vehicle_brand" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "vehicle_model" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "vehicle_year" integer;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "vehicle_color" text;