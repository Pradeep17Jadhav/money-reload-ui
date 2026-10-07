import { render, screen } from "@testing-library/react";
import { useAuth } from "@/contexts/authContext";
import RequireAnonymous from "@/components/RequireAnonymous/RequireAnonymous";
import RequireAuth from "@/components/RequireAuth/RequireAuth";
import type { AuthStatus } from "@/types/AuthTypes";

const replace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
}));

jest.mock("@/contexts/authContext", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as unknown as jest.Mock;

const setStatus = (status: AuthStatus) =>
  mockUseAuth.mockReturnValue({
    status,
    user: status === "authenticated" ? { firstName: "Probe", lastName: "One" } : null,
    isSignedIn: status === "authenticated",
    sessionRestoreMessage: null,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
  });

describe("route guards", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  describe("RequireAuth", () => {
    it("renders the private content for a signed-in user", () => {
      setStatus("authenticated");
      render(<RequireAuth>Private content</RequireAuth>);

      expect(screen.getByText("Private content")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("shows a progress affordance rather than the content while checking", () => {
      setStatus("initialising");
      render(<RequireAuth>Private content</RequireAuth>);

      expect(screen.queryByText("Private content")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/checking your session/i);
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("redirects once when there is no session", () => {
      setStatus("unauthenticated");
      const { rerender } = render(<RequireAuth>Private content</RequireAuth>);

      expect(screen.queryByText("Private content")).not.toBeInTheDocument();

      rerender(<RequireAuth>Private content</RequireAuth>);
      rerender(<RequireAuth>Private content</RequireAuth>);

      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/login");
    });
  });

  describe("RequireAnonymous", () => {
    it("renders the form for a signed-out user", () => {
      setStatus("unauthenticated");
      render(<RequireAnonymous>The form</RequireAnonymous>);

      expect(screen.getByText("The form")).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it("shows a progress affordance rather than the form while checking", () => {
      setStatus("initialising");
      render(<RequireAnonymous>The form</RequireAnonymous>);

      expect(screen.queryByText("The form")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/checking your session/i);
    });

    it("navigates once for a session that already exists, without a second navigation", () => {
      // The same effect serves a session restored on load and one created by the
      // form, so neither can take a different path.
      setStatus("authenticated");
      const { rerender } = render(<RequireAnonymous>The form</RequireAnonymous>);

      rerender(<RequireAnonymous>The form</RequireAnonymous>);
      rerender(<RequireAnonymous>The form</RequireAnonymous>);

      expect(screen.queryByText("The form")).not.toBeInTheDocument();
      expect(replace).toHaveBeenCalledTimes(1);
      expect(replace).toHaveBeenCalledWith("/profile");
    });
  });
});