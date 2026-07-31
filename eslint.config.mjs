import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Next 16's react-hooks plugin errors on `setState` called in an effect's
      // synchronous body. Every occurrence here is the same benign shape — a
      // fetch-on-mount that flips a `loading` flag before awaiting — plus the
      // shadcn/payroll-ui components this project mirrors, which use it in
      // `use-mobile`, `DateInput` and `TimeInput`. Kept visible as a warning.
      "react-hooks/set-state-in-effect": "warn",
      // Trips only inside the payroll-ui helpers copied verbatim
      // (`lib/optimizeComponent.js` forwards a caller-supplied dep array, and
      // shadcn's sidebar skeleton randomises its width).
      "react-hooks/use-memo": "warn",
      "react-hooks/purity": "warn",
      // payroll-ui's form primitives are anonymous arrows wrapped in `memo`.
      "react/display-name": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
  ]),
]);

export default eslintConfig;
