import { useFocusEffect } from "expo-router";
import { useGlobalState } from "@/lib/gState";
import { useCallback } from "react";

const useTitle = (title: string, delay = 100) => {
  const setTitle = useGlobalState((s) => s.setTitle);
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => setTitle(title), delay);
      return () => clearTimeout(timer);
    }, [title, setTitle, delay]),
  );
};

export default useTitle;
