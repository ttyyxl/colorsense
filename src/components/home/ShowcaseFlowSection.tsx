import { PaletteExplorer } from "./PaletteExplorer";
import { SeasonPreviewStack } from "./SeasonPreviewStack";
import type { PaletteGroup } from "./home-data";
import type { SeasonProfile } from "@/lib/seasons";

export function ShowcaseFlowSection({
  seasons,
  paletteGroups,
}: {
  seasons: SeasonProfile[];
  paletteGroups: PaletteGroup[];
}) {
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-[#81bfe9]/16 bg-white/24 p-3 shadow-[0_30px_70px_-36px_rgba(24,22,152,0.16)] backdrop-blur-[20px] sm:p-4 lg:p-5">
      <div className="absolute left-1/2 top-8 h-72 w-72 -translate-x-1/2 rounded-full bg-[#addce6]/16 blur-3xl" />
      <div className="relative space-y-8 md:space-y-10">
        <SeasonPreviewStack seasons={seasons} />
        <div className="mx-auto flex h-14 w-px justify-center bg-gradient-to-b from-transparent via-[#81bfe9]/34 to-transparent" aria-hidden="true" />
        <PaletteExplorer groups={paletteGroups} />
      </div>
    </section>
  );
}
