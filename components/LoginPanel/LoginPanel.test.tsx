import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPanel from "@/components/LoginPanel/LoginPanel";
import { useAuth } from "@/contexts/authContext";
import { INVALID_CREDENTIALS_MESSAGE } from "@/helpers/authErrors";
import { AuthErrorCode } from "@/types/AuthTypes";
import { createApiError, createAuthResult, createDeferred } from "@/tests/factories/authFactories";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/contexts/authContext", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as unknown as jest.Mock;

const signIn = jest.fn();

const renderPanel = () => {
  const user = userEvent.setup();
  render(<LoginPanel />);
  return user;
};

const submitButton = () => screen.getByRole("button", { name: "sign in" });

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>, identifier: string) => {
  await user.type(screen.getByLabelText("username or email"), identifier);
  await user.type(screen.getByLabelText("password"), "abc12345");
  await user.click(submitButton());
};

describe("LoginPanel", () => {
  beforeEach(() => {
    signIn.mockReset();
    mockUseAuth.mockReturnValue({
      status: "unauthenticated",
      user: null,
      isSignedIn: false,
      sessionRestoreMessage: null,
      signIn,
      signUp: jest.fn(),
      signOut: jest.fn(),
    });
  });

  it("renders the form with submit disabled until it is valid", async () => {
    const user = renderPanel();

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();

    await user.type(screen.getByLabelText("username or email"), "probe1");
    expect(submitButton()).toBeDisabled();

    await user.type(screen.getByLabelText("password"), "abc12345");
    expect(submitButton()).toBeEnabled();
  });

  it("shows no error on a field the user has not touched", () => {
    renderPanel();

    expect(screen.queryByText(/enter your username or email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/enter your password/i)).not.toBeInTheDocument();
  });

  it("shows a field message for an invalid value and clears it once corrected", async () => {
    const user = renderPanel();
    const identifier = screen.getByLabelText("username or email");

    await user.type(identifier, "ab");
    await user.tab();

    expect(await screen.findByText(/between 3 and 30/i)).toBeInTheDocument();
    expect(identifier).toHaveAttribute("aria-invalid", "true");

    await user.type(identifier, "c");

    await waitFor(() => {
      expect(screen.queryByText(/between 3 and 30/i)).not.toBeInTheDocument();
    });
    expect(identifier).toHaveAttribute("aria-invalid", "false");
  });

  it("links the message to the input it belongs to", async () => {
    const user = renderPanel();
    const identifier = screen.getByLabelText("username or email");

    await user.type(identifier, "ab");
    await user.tab();

    const message = await screen.findByText(/between 3 and 30/i);
    expect(identifier).toHaveAttribute("aria-describedby", message.id);
  });

  it("never sends an invalid request", async () => {
    const user = renderPanel();

    await user.type(screen.getByLabelText("username or email"), "ab");
    await user.type(screen.getByLabelText("password"), "abc12345");

    // Submit is disabled, and pressing Enter cannot reach the network either.
    expect(submitButton()).toBeDisabled();
    await user.keyboard("{Enter}");

    expect(signIn).not.toHaveBeenCalled();
  });

  it("sends the identifier exactly as typed", async () => {
    const user = renderPanel();
    signIn.mockResolvedValue(createAuthResult());

    await fillAndSubmit(user, "  Probe1@Example.COM  ");

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));

    // Never normalised before sending: a mangled value would make a transport
    // problem indistinguishable from a normalisation one.
    expect(signIn).toHaveBeenCalledWith({
      identifier: "  Probe1@Example.COM  ",
      password: "abc12345",
    });
  });

  it("shows a progress affordance and refuses resubmission while in flight", async () => {
    const deferred = createDeferred<ReturnType<typeof createAuthResult>>();
    signIn.mockReturnValue(deferred.promise);

    const user = renderPanel();
    await fillAndSubmit(user, "probe1");

    await waitFor(() => expect(submitButton()).toBeDisabled());
    expect(submitButton()).toHaveTextContent("sign in");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    deferred.resolve(createAuthResult());

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
  });

  it("renders the banner when the server rejects the sign-in", async () => {
    const user = renderPanel();
    signIn.mockRejectedValue(createApiError(AuthErrorCode.INVALID_CREDENTIALS));

    await fillAndSubmit(user, "probe1");

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(INVALID_CREDENTIALS_MESSAGE);
  });

  it("gives the same message for a wrong password, an unknown username and an unknown email", async () => {
    // The API cannot tell these apart and returns one code for all three. The
    // server's own wording must not reintroduce the distinction either.
    const serverMessages = [
      "No user matches probe1.",
      "Password is incorrect.",
      "Invalid username, email or password.",
    ];

    const rendered: string[] = [];

    for (const serverMessage of serverMessages) {
      signIn.mockRejectedValue(
        createApiError(AuthErrorCode.INVALID_CREDENTIALS, { message: serverMessage })
      );

      const user = renderPanel();
      await fillAndSubmit(user, "probe1");

      const banner = await screen.findByRole("alert");
      rendered.push(banner.textContent ?? "");
      expect(banner).not.toHaveTextContent(serverMessage);

      cleanup();
    }

    expect(new Set(rendered).size).toBe(1);
    expect(rendered[0]).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it("puts a field-attached error on the input it belongs to", async () => {
    const user = renderPanel();
    signIn.mockRejectedValue(
      createApiError(AuthErrorCode.VALIDATION_FAILED, {
        details: [
          { field: "password", code: "field_required", message: "Password is required." },
        ],
      })
    );

    await fillAndSubmit(user, "probe1");

    const password = screen.getByLabelText("password");
    const message = await screen.findByText("Password is required.");

    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute("aria-describedby", message.id);
    // Nothing attached to a field belongs on the banner.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says when to retry after being rate limited", async () => {
    const user = renderPanel();
    signIn.mockRejectedValue(createApiError(AuthErrorCode.TOO_MANY_REQUESTS, { retryAfter: 125 }));

    await fillAndSubmit(user, "probe1");

    expect(await screen.findByRole("alert")).toHaveTextContent(/about 3 minutes/i);
  });

  it("explains an unexpected sign-out caused by a session that could not be checked", async () => {
    mockUseAuth.mockReturnValue({
      status: "unauthenticated",
      user: null,
      isSignedIn: false,
      sessionRestoreMessage: "Your saved session is no longer valid, so we signed you out.",
      signIn,
      signUp: jest.fn(),
      signOut: jest.fn(),
    });

    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(/no longer valid/i);
  });

  it("links on to registration", () => {
    renderPanel();

    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/register"
    );
  });
});