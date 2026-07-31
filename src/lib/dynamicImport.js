import dynamic from "next/dynamic";
import { Suspense } from "react";

export function createDynamicComponent(importFunc, loadingComponent = null) {
  return dynamic(importFunc, {
    loading: () => loadingComponent,
    suspense: true,
  });
}

export function withSuspense(Component, FallbackComponent = null) {
  return function SuspenseWrapper(props) {
    return (
      <Suspense fallback={FallbackComponent}>
        <Component {...props} />
      </Suspense>
    );
  };
}

// Usage example:
// const DynamicComponent = createDynamicComponent(() => import('./HeavyComponent'));
// const WrappedComponent = withSuspense(DynamicComponent, <LoadingSpinner />);
