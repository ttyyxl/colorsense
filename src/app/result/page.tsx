"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function ResultIndexPage() {
  return (
    <ProtectedRoute>
      <ResultRedirect />
    </ProtectedRoute>
  );
}

function ResultRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/history");
  }, [router]);
  return null;
}
