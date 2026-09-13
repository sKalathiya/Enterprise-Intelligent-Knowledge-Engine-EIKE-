import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Register · EIKE",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
