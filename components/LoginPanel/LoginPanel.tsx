"use client";

import { useCallback, useMemo, useState } from "react";
import AuthPanel from "@/components/AuthPanel/AuthPanel";
import AuthField from "@/components/AuthField/AuthField";
import { useAuth } from "@/contexts/authContext";
import { getAuthErrorCopy, getRateLimitMessage } from "@/helpers/apiErrors";
import {
  LOGIN_INITIAL_VALUES,
  hasErrors,
  validateLoginForm,
} from "@/helpers/authValidation";
import type { LoginFormValues } from "@/helpers/authValidation";
import { PATHS } from "@/constants/path";

type FieldName = keyof LoginFormValues;

type TouchedState = Partial<Record<FieldName, boolean>>;

const LoginPanel = () => {
  const { signIn, sessionRestoreMessage } = useAuth();

  const [values, setValues] = useState<LoginFormValues>(LOGIN_INITIAL_VALUES);
  const [touched, setTouched] = useState<TouchedState>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(sessionRestoreMessage);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const errors = useMemo(() => validateLoginForm(values), [values]);
  const isValid = !hasErrors(errors);

  const setField = useCallback((field: FieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setBanner(null);
    setServerFieldErrors((current) => {
      if (!(field in current)) {
        return current;
      }

      const { [field]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const markTouched = useCallback((field: FieldName) => {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  }, []);

  /**
   * An error the server attached to a field wins over the local one, because the
   * local rules only mirror the server's and do not replace it.
   */
  const visibleError = useCallback(
    (field: FieldName): string | undefined =>
      serverFieldErrors[field] ?? ((touched[field] || hasSubmitted) ? errors[field] : undefined),
    [errors, hasSubmitted, serverFieldErrors, touched]
  );

  const handleSubmit = useCallback(async () => {
    setHasSubmitted(true);
    setBanner(null);

    // An invalid request never reaches the network.
    if (hasErrors(validateLoginForm(values))) {
      return;
    }

    setIsSubmitting(true);
    setServerFieldErrors({});

    try {
      // Sent exactly as typed. The server trims and matches case-insensitively;
      // lowercasing here would turn a transport problem into a normalisation one.
      await signIn({ identifier: values.identifier, password: values.password });
      // Navigation is driven by the page watching the auth status, so a session
      // restored on load and one created here follow the same path.
    } catch (error) {
      const copy = getAuthErrorCopy(error);
      setBanner(getRateLimitMessage(error) ?? copy.banner);
      setServerFieldErrors(copy.fields);
    } finally {
      setIsSubmitting(false);
    }
  }, [signIn, values]);

  return (
    <AuthPanel
      title="Sign in"
      subtitle="Track your loans, income, expenses and goals in one place."
      banner={banner}
      onSubmit={() => {
        void handleSubmit();
      }}
      isSubmitting={isSubmitting}
      isValid={isValid}
      submitLabel="sign in"
      switchPrompt="New to MoneyReload?"
      switchHref={PATHS.REGISTER}
      switchLabel="Create an account"
    >
      <AuthField
        id="login-identifier"
        label="username or email"
        value={values.identifier}
        onChange={(value) => setField("identifier", value)}
        onBlur={() => markTouched("identifier")}
        error={visibleError("identifier")}
        autoComplete="username"
      />

      <AuthField
        id="login-password"
        label="password"
        value={values.password}
        onChange={(value) => setField("password", value)}
        onBlur={() => markTouched("password")}
        error={visibleError("password")}
        type="password"
        autoComplete="current-password"
        withVisibilityToggle
      />
    </AuthPanel>
  );
};

export default LoginPanel;