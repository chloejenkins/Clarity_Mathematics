import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { MotionConfig } from "framer-motion";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
    {/* Honour the system Reduce Motion setting for every framer-motion animation */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </ClerkProvider>
);
