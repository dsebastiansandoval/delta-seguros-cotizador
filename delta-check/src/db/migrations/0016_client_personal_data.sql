CREATE TYPE "public"."marital_status" AS ENUM('CASADO', 'DIVORCIADO', 'SOLTERO', 'UNION_DE_HECHO', 'VIUDO');--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "marital_status" "marital_status";--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "previous_premium_cents" bigint;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "previous_start_date" date;