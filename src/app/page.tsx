import { HomeDashboard } from "@/components/home/HomeDashboard";
import { SEASONS } from "@/lib/seasons";

export default function Home() {
  return <HomeDashboard seasons={Object.values(SEASONS)} />;
}
