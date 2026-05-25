import { redirect } from "next/navigation";

interface RegisterPageProps {
  searchParams?: { next?: string };
}

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  const requestedNext = searchParams?.next;
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/upload";
  redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}
