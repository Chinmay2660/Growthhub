"use client";

import { useDocumentTitle } from "@/lib/use-document-title";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  useDocumentTitle("Sign up");
  useEffect(() => {
    router.replace("/login?tab=signup");
  }, [router]);
  return null;
}
