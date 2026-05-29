import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Diagnosis, NewDiagnosis } from "./types";

function getDiagnosesCollection() {
  if (!db) {
    throw new Error("尚未配置 Firebase，无法访问诊断记录。");
  }
  return collection(db, "diagnoses");
}

export async function createDiagnosis(userId: string, input: NewDiagnosis) {
  const { scores, ...requiredFields } = input;
  const ref = await addDoc(getDiagnosesCollection(), {
    ...requiredFields,
    ...(scores === undefined ? {} : { scores }),
    userId,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

function readDiagnosis(id: string, data: Record<string, unknown>): Diagnosis {
  const timestamp = data.createdAt as { toDate?: () => Date } | undefined;
  return {
    ...(data as Omit<Diagnosis, "id" | "createdAt">),
    id,
    createdAt: timestamp?.toDate ? timestamp.toDate().toISOString() : new Date().toISOString(),
  };
}

export async function listUserDiagnoses(userId: string) {
  const snapshot = await getDocs(query(getDiagnosesCollection(), where("userId", "==", userId)));
  return snapshot.docs
    .map((item) => readDiagnosis(item.id, item.data()))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export async function getUserDiagnosis(id: string, userId: string) {
  if (!db) {
    throw new Error("尚未配置 Firebase，无法访问诊断记录。");
  }
  const snapshot = await getDoc(doc(db, "diagnoses", id));
  if (!snapshot.exists()) {
    return null;
  }
  const diagnosis = readDiagnosis(snapshot.id, snapshot.data());
  return diagnosis.userId === userId ? diagnosis : null;
}

export async function deleteUserDiagnosis(id: string, userId: string) {
  const diagnosis = await getUserDiagnosis(id, userId);
  if (!diagnosis) {
    throw new Error("无法删除不属于当前用户的记录。");
  }
  await deleteDoc(doc(db!, "diagnoses", id));
}
