"use client";

import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import type { SeasonProfile } from "@/lib/seasons";
import { FooterGradient } from "./FooterGradient";
import { HeroBanner } from "./HeroBanner";
import { MobileActionBar } from "./MobileActionBar";
import { ShowcaseFlowSection } from "./ShowcaseFlowSection";
import { mobileActions, paletteGroups, primaryActions } from "./home-data";

const springTransition = { type: "spring", stiffness: 140, damping: 20 } as const;

export function HomeDashboard({ seasons }: { seasons: SeasonProfile[] }) {
  return (
    <main className="home-dashboard-shell min-h-screen text-[#181698]">
      <Navbar />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="mx-auto flex w-full max-w-7xl flex-col gap-18 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:gap-20 md:pb-20 lg:pt-8"
      >
        <HeroBanner primaryActions={primaryActions} />
        <ShowcaseFlowSection seasons={seasons} paletteGroups={paletteGroups} />
        <FooterGradient />
      </motion.div>
      <MobileActionBar actions={mobileActions} />
    </main>
  );
}
