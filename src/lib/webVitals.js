import { onCLS, onINP, onLCP } from "web-vitals";

export function reportWebVitals(onPerfEntry) {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    onCLS(onPerfEntry);
    onINP(onPerfEntry); // Using INP (Interaction to Next Paint) instead of FID
    onLCP(onPerfEntry);
  }
}

export function logWebVitals() {
  reportWebVitals((metric) => {
    console.log(metric);
  });
}
