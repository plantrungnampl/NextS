import { SignUp } from "@clerk/nextjs";

import { APP_ROUTES } from "@/core";

export default function SignUpPage() {
  return (
    <div className="w-full">
      <SignUp
        fallbackRedirectUrl={APP_ROUTES.workspace.index}
        path="/sign-up"
        routing="path"
        signInUrl={APP_ROUTES.login}
      />
    </div>
  );
}
