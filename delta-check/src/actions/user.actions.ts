"use server";

import { revalidatePath } from "next/cache";
import { withOrganization } from "@/db";
import { requirePermission } from "@/domains/identity/services/rbac.service";
import { UserAdminError, userAdminService } from "@/domains/identity/services/user-admin.service";
import { createUserSchema, updateUserSchema, userFormToObject } from "@/domains/identity/schemas/user.schema";
import { audit } from "@/domains/shared/audit";
import type { ActionResult } from "./quote.actions";

export async function listUsers() {
  const session = await requirePermission("user:manage");
  return withOrganization(session.organizationId, (tx) => userAdminService.list(tx));
}

export async function createUser(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("user:manage");

  const parsed = createUserSchema.safeParse(userFormToObject(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  try {
    await withOrganization(session.organizationId, async (tx) => {
      const user = await userAdminService.create(tx, session.organizationId, parsed.data);
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "user.created",
        entityType: "users",
        entityId: user.id,
        metadata: { role: parsed.data.role, branches: parsed.data.branches },
      });
    });
  } catch (error) {
    if (error instanceof UserAdminError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, value: undefined };
}

export async function updateUser(_prevState: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("user:manage");

  const parsed = updateUserSchema.safeParse(userFormToObject(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };

  try {
    await withOrganization(session.organizationId, async (tx) => {
      await userAdminService.update(tx, session.organizationId, session.userId, parsed.data);
      await audit(tx, {
        organizationId: session.organizationId,
        userId: session.userId,
        action: "user.updated",
        entityType: "users",
        entityId: parsed.data.userId,
        metadata: { role: parsed.data.role, branches: parsed.data.branches, isActive: parsed.data.isActive },
      });
    });
  } catch (error) {
    if (error instanceof UserAdminError) return { ok: false, errors: { form: [error.message] } };
    throw error;
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, value: undefined };
}
