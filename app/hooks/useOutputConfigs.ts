import { useCallback, useEffect, useState } from "react";
import type { OutputConfig } from "../lib/rngPrompt/types";

export const useOutputConfigs = () => {
  const [outputConfigs, setOutputConfigs] = useState<OutputConfig[]>([]);
  const [activeOutputConfigId, setActiveOutputConfigId] = useState<string | null>(null);

  const applyOutputConfigs = useCallback((configs: OutputConfig[]) => {
    setOutputConfigs(configs);
    const active = configs.find((config) => config.is_active);
    setActiveOutputConfigId(active?.id ?? null);
  }, []);

  const fetchOutputConfigs = useCallback(async () => {
    const res = await fetch("/api/output-configs");
    if (!res.ok) throw new Error("Output configs API not found");
    const payload = (await res.json()) as { configs?: OutputConfig[] };
    return payload.configs ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadConfigs = async () => {
      try {
        const configs = await fetchOutputConfigs();
        if (!cancelled) applyOutputConfigs(configs);
      } catch (_error) {
        if (!cancelled) applyOutputConfigs([]);
      }
    };
    loadConfigs();
    return () => {
      cancelled = true;
    };
  }, [fetchOutputConfigs, applyOutputConfigs]);

  return {
    outputConfigs,
    activeOutputConfigId,
    applyOutputConfigs,
    fetchOutputConfigs,
  };
};
