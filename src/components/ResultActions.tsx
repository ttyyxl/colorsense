import type { RefObject } from "react";
import { ShareModal } from "./ShareModal";

interface ResultActionsProps {
  diagnosisId: string;
  cardRef: RefObject<HTMLDivElement>;
}

export function ResultActions({ diagnosisId, cardRef }: ResultActionsProps) {
  return <ShareModal diagnosisId={diagnosisId} cardRef={cardRef} />;
}
