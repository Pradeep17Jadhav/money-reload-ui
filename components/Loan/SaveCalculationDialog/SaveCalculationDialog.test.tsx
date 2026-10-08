import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SaveCalculationDialog from "@/components/Loan/SaveCalculationDialog/SaveCalculationDialog";

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof SaveCalculationDialog>> = {}
) => {
  const onSubmit = jest.fn();
  const onClose = jest.fn();

  const { rerender } = render(
    <SaveCalculationDialog
      open
      isSaving={false}
      banner={null}
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />
  );

  return { user: userEvent.setup(), onSubmit, onClose, rerender };
};

const nameInput = () => screen.getByTestId("calculation-name-input");
const descriptionInput = () =>
  screen.getByTestId("calculation-description-input");
const submitButton = () => screen.getByTestId("save-calculation-submit");

describe("SaveCalculationDialog", () => {
  it("asks for a name and a description", () => {
    renderDialog();

    expect(screen.getByLabelText(/calculation name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("keeps Save inert until there is a name to save", async () => {
    const { user } = renderDialog();

    expect(submitButton()).toBeDisabled();

    await user.type(nameInput(), "Best case");

    expect(submitButton()).toBeEnabled();
  });

  it("does not treat whitespace as a name", async () => {
    const { user } = renderDialog();

    await user.type(nameInput(), "   ");

    expect(submitButton()).toBeDisabled();
  });

  it("hands over the name and description the user typed", async () => {
    const { user, onSubmit } = renderDialog();

    await user.type(nameInput(), "Best case");
    await user.type(descriptionInput(), "Prepay 1L a year");
    await user.click(submitButton());

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Best case",
      description: "Prepay 1L a year",
    });
  });

  it("sends a blank description rather than omitting it", async () => {
    const { user, onSubmit } = renderDialog();

    await user.type(nameInput(), "Best case");
    await user.click(submitButton());

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Best case",
      description: "",
    });
  });

  it("opens empty each time, so it never carries the last scenario's name", async () => {
    const { user, onSubmit, rerender } = renderDialog();

    await user.type(nameInput(), "Best case");
    onSubmit.mockClear();

    rerender(
      <SaveCalculationDialog
        open={false}
        isSaving={false}
        banner={null}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />
    );
    rerender(
      <SaveCalculationDialog
        open
        isSaving={false}
        banner={null}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(nameInput()).toHaveValue("");
    expect(descriptionInput()).toHaveValue("");
  });

  it("closes without saving when cancelled", async () => {
    const { user, onSubmit, onClose } = renderDialog();

    await user.click(screen.getByTestId("save-calculation-cancel"));

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the API's own complaint about the name on the field", () => {
    renderDialog({ errors: { name: "That name is too long." } });

    expect(screen.getByText("That name is too long.")).toBeInTheDocument();
  });

  it("shows a form-level message without touching the fields", () => {
    renderDialog({ banner: "We could not save that calculation." });

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent("We could not save that calculation.");
  });

  it("locks the form while the request is in flight", () => {
    renderDialog({ isSaving: true });

    expect(nameInput()).toBeDisabled();
    expect(descriptionInput()).toBeDisabled();
    expect(submitButton()).toBeDisabled();
    expect(screen.getByLabelText("Saving")).toBeInTheDocument();
  });
});