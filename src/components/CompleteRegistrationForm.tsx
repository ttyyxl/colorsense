import { AuthForm } from "./AuthForm";

interface CompleteRegistrationFormProps {
  nextPath: string;
}

export function CompleteRegistrationForm({ nextPath }: CompleteRegistrationFormProps) {
  return <AuthForm nextPath={nextPath} />;
}
