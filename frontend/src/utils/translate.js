import { useMemo } from "react";
import { useUI } from "../context/UIContext";

export function useTranslate() {
  const { t } = useUI();
  return useMemo(() => t, [t]);
}
