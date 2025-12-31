import { useCallback } from "react";

type AdminPayload = Record<string, unknown>;

type UseAdminMutationsArgs = {
  onRefreshData: () => Promise<void>;
};

export const useAdminMutations = ({ onRefreshData }: UseAdminMutationsArgs) => {
  const runAdminMutation = useCallback(
    async (payload: AdminPayload, errorMessage: string) => {
      try {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Admin API failed");
        await onRefreshData();
        return true;
      } catch (_error) {
        window.alert(errorMessage);
        return false;
      }
    },
    [onRefreshData],
  );

  return { runAdminMutation };
};
