import Link from "next/link";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import { APP_ROUTES } from "@/core";
import { getFirstQueryParamValue, isPromise } from "@/shared";

import { login, signup } from "./actions";

type LoginSearchParams = {
  message?: string | string[];
  next?: string | string[];
  type?: string | string[];
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
  const message = getFirstQueryParamValue(resolvedSearchParams.message);
  const nextPath = getFirstQueryParamValue(resolvedSearchParams.next);
  const messageType = getFirstQueryParamValue(resolvedSearchParams.type);
  const isSuccess = messageType === "success";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sign in to NexaBoard</CardTitle>
        <CardDescription>
          Continue with your workspace account or create a new one to start collaborating.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {message ? (
          <p
            className={
              isSuccess
                ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            }
          >
            {message}
          </p>
        ) : null}

        <form className="space-y-4">
          <input name="next" type="hidden" value={nextPath ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              name="email"
              placeholder="you@company.com"
              required
              type="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              autoComplete="current-password"
              id="password"
              minLength={8}
              name="password"
              placeholder="At least 8 characters"
              required
              type="password"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button formAction={login} type="submit">
              Log in
            </Button>
            <Button formAction={signup} type="submit" variant="secondary">
              Sign up
            </Button>
          </div>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Back to{" "}
          <Link className="font-medium text-sky-700 underline-offset-2 hover:underline" href={APP_ROUTES.home}>
            home
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
