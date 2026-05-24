import type { Diagnosis } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var colorsenseDiagnoses: Diagnosis[] | undefined;
}

const store = globalThis.colorsenseDiagnoses ?? [];

if (!globalThis.colorsenseDiagnoses) {
  globalThis.colorsenseDiagnoses = store;
}

export function saveDiagnosis(diagnosis: Diagnosis) {
  store.unshift(diagnosis);
  return diagnosis;
}

export function listDiagnoses() {
  return store;
}

export function getDiagnosis(id: string) {
  return store.find((diagnosis) => diagnosis.id === id);
}
