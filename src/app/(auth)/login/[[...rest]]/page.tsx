import { SignIn } from "@clerk/nextjs";

import { APP_ROUTES } from "@/core";
import { getFirstQueryParamValue, isPromise } from "@/shared";

type LoginSearchParams = {
  next?: string | string[];
};

type LoginPageProps = {
  searchParams?: LoginSearchParams | Promise<LoginSearchParams>;
};

async function resolveSearchParams(
  searchParams: LoginPageProps["searchParams"],
): Promise<LoginSearchParams> {
  if (!searchParams) {
    return {};
  }

  if (isPromise(searchParams)) {
    return (await searchParams) ?? {};
  }

  return searchParams;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const nextPath = getFirstQueryParamValue(resolvedSearchParams.next);

  return (
    <div className="w-full">
      <SignIn
        fallbackRedirectUrl={APP_ROUTES.workspace.index}
        forceRedirectUrl={nextPath ?? APP_ROUTES.workspace.index}
        path={APP_ROUTES.login}
        routing="path"
        signUpUrl="/sign-up"
      />
    </div>
  );
}
