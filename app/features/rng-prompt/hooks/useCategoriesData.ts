import { useCallback, useEffect, useState } from "react";
import type { Category } from "../lib/types";

type UseCategoriesDataArgs = {
  mockData: Category[];
};

export const useCategoriesData = ({ mockData }: UseCategoriesDataArgs) => {
  const [configData, setConfigData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);

  const refreshConfigData = useCallback(async () => {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error("API not found");
    return (await res.json()) as Category[];
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await refreshConfigData();
        if (!cancelled) {
          setConfigData(data);
          setUseMock(false);
        }
      } catch (_error) {
        if (!cancelled) {
          setConfigData(mockData);
          setUseMock(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [refreshConfigData, mockData]);

  const refreshData = useCallback(async () => {
    const data = await refreshConfigData();
    setConfigData(data);
    setUseMock(false);
  }, [refreshConfigData]);

  return {
    configData,
    loading,
    useMock,
    refreshConfigData,
    refreshData,
  };
};
