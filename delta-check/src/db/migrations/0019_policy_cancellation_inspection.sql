CREATE TYPE "public"."commission_discount_status" AS ENUM('PENDIENTE', 'DESCONTADA');--> statement-breakpoint
ALTER TYPE "public"."issue_status" ADD VALUE 'INSPECCION' BEFORE 'EMITIDA';--> statement-breakpoint
ALTER TYPE "public"."lifecycle_status" ADD VALUE 'CANCELACION_PENDIENTE' BEFORE 'CANCELADA';--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "discount_status" "commission_discount_status";--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "discount_amount_cents" bigint;--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "discounted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "policies" ADD COLUMN "cancelled_premium_cents" bigint;