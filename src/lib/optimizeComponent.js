import { memo, useCallback, useMemo, useState, useEffect } from "react";

export function withMemo(Component, propsAreEqual) {
  return memo(Component, propsAreEqual);
}

export function createMemoizedComponent(Component) {
  return memo(Component, (prevProps, nextProps) => {
    const prev = Object.keys(prevProps);
    const next = Object.keys(nextProps);

    if (prev.length !== next.length) return false;

    return prev.every((key) => {
      if (
        typeof prevProps[key] === "function" ||
        typeof nextProps[key] === "function"
      ) {
        // Skip function comparison as they might be recreated
        return true;
      }
      return prevProps[key] === nextProps[key];
    });
  });
}

export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useMemoizedCallback(callback, deps) {
  return useCallback(callback, deps);
}

export function useMemoizedValue(valueFactory, deps) {
  return useMemo(valueFactory, deps);
}

// Helper to determine if component should update
export function createShallowEqualHOC(Component) {
  return memo(Component, (prevProps, nextProps) => {
    if (Object.keys(prevProps).length !== Object.keys(nextProps).length) {
      return false;
    }

    return !Object.keys(prevProps).some((key) => {
      if (typeof prevProps[key] === "function") return false;
      if (Array.isArray(prevProps[key])) {
        return (
          JSON.stringify(prevProps[key]) !== JSON.stringify(nextProps[key])
        );
      }
      return prevProps[key] !== nextProps[key];
    });
  });
}

// Performance monitoring wrapper
export function withPerformanceTracking(Component, componentName = "Unknown") {
  return function PerformanceWrapper(props) {
    useEffect(() => {
      const startTime = performance.now();

      return () => {
        const endTime = performance.now();
        if (endTime - startTime > 16) {
          // 16ms = 1 frame at 60fps
          console.warn(
            `[Performance] ${componentName} took ${Math.round(
              endTime - startTime
            )}ms to render`
          );
        }
      };
    });

    return <Component {...props} />;
  };
}
