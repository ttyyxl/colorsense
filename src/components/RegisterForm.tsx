import { AuthForm } from "./AuthForm";

interface RegisterFormProps {
  nextPath: string;
}

export function RegisterForm({ nextPath }: RegisterFormProps) {
  return <AuthForm nextPath={nextPath} />;
}
