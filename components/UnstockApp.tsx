"use client";

import { useState } from "react";
import LandingScreen from "@/components/LandingScreen";
import ValuationWizard from "@/components/ValuationWizard";

export default function UnstockApp() {
  const [started, setStarted] = useState(false);

  return started ? <ValuationWizard /> : <LandingScreen onStart={() => setStarted(true)} />;
}
