"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { type EntityConfig, type Role } from "@/components/entities/types";
import { getEffectiveRoles } from "@/lib/roles";

export interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canView: boolean;
  /** Convenience: true when at least one of create/edit/delete is allowed */
  canMutate: boolean;
  /** Pass a custom role list to check ad-hoc permissions beyond the entity config */
  hasRole: (role: Role) => boolean;
}

type SessionWithRoles = {
  user?: { roles?: Record<string, unknown> };
} | null;

/**
 * Derives permission booleans for a given EntityConfig from the active session.
 *
 * Usage:
 *   const { canEdit, canDelete } = usePermissions(config);
 *
 * Can also be used without a config for raw role checks:
 *   const { hasRole } = usePermissions();
 *   if (hasRole("admin")) { ... }
 */
export function usePermissions(config?: EntityConfig): Permissions {
  const { data: session } = useSession();
  const sessionData = session as SessionWithRoles;

  const activeRoles = useMemo<Role[]>(
    () => getEffectiveRoles(sessionData?.user?.roles),
    [sessionData],
  );

  const hasRole = (role: Role) => activeRoles.includes(role);

  const canCreate = config
    ? config.permissions.create.some((r) => activeRoles.includes(r))
    : false;

  const canEdit = config
    ? config.permissions.edit.some((r) => activeRoles.includes(r))
    : false;

  const canDelete = config
    ? config.permissions.delete.some((r) => activeRoles.includes(r))
    : false;

  const canView = config
    ? config.permissions.view.some((r) => activeRoles.includes(r))
    : false;

  return {
    canCreate,
    canEdit,
    canDelete,
    canView,
    canMutate: canCreate || canEdit || canDelete,
    hasRole,
  };
}