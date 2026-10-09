import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdditionalIncomeSection from "@/components/IncomeTax/AdditionalIncomeSection/AdditionalIncomeSection";
import type { AdditionalIncomeEntry } from "@/types/IncomeTax/CalculationTypes";

/** Rs 2,40,000.00 in paise, as the list holds it. */
const RENT: AdditionalIncomeEntry = { source: "Rent from a flat", amount: 24_000_000 };

/**
 * The section rendered with a real list, so the rows exist to be edited.
 *
 * A wrapper rather than a bare render because the point is what the rows do: the section is
 * otherwise an empty section with a button, and an edit test needs a row to click.
 */
const Harness = ({
  initial,
  onChange,
}: {
  initial: AdditionalIncomeEntry[];
  onChange: (entry: AdditionalIncomeEntry, index: number | null) => void;
}) => {
  const [entries, setEntries] = useState(initial);

  return (
    <AdditionalIncomeSection
      entries={entries}
      onChange={(entry, index) => {
        setEntries((current) =>
          index === null
            ? [...current, entry]
            : current.map((existing, i) => (i === index ? entry : existing))
        );
        onChange(entry, index);
      }}
      onRemove={(index) =>
        setEntries((current) => current.filter((_, i) => i !== index))
      }
    />
  );
};

describe("the additional income list", () => {
  it("says so plainly when there is nothing", () => {
    render(
      <AdditionalIncomeSection entries={[]} onChange={jest.fn()} onRemove={jest.fn()} />
    );

    expect(screen.getByText(/earned on top of your salary/i)).toBeInTheDocument();
    // No table at all rather than an empty one: a header row over nothing is noise.
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("draws the lines as a MUI table, with the figures on screen", () => {
    render(
      <AdditionalIncomeSection
        entries={[RENT, { source: "Interest", amount: 15_000_000 }]}
        onChange={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    const table = screen.getByRole("table");

    expect(within(table).getByRole("columnheader", { name: /source/i })).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: /annual amount/i })
    ).toBeInTheDocument();
    expect(within(table).getByText("Rent from a flat")).toBeInTheDocument();
    expect(within(table).getByText(/2,40,000/)).toBeInTheDocument();
  });

  it("adds a line from a blank dialog", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<Harness initial={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add income/i }));
    await user.type(screen.getByTestId("additional-income-source"), "Rent from a flat");
    await user.type(screen.getByTestId("additional-income-amount"), "240000");
    await user.click(screen.getByTestId("additional-income-save"));

    // Rupees in, paise out — the one conversion, done in the dialog.
    expect(onChange).toHaveBeenCalledWith(
      { source: "Rent from a flat", amount: 24_000_000 },
      null
    );
  });

  it("opens an edit dialog already holding the line", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<Harness initial={[RENT]} onChange={onChange} />);

    await user.click(screen.getByTestId("edit-additional-income-0"));

    // Both facts come back, with the amount as the whole rupees the box holds.
    expect(screen.getByTestId("additional-income-source")).toHaveValue("Rent from a flat");
    expect(screen.getByTestId("additional-income-amount")).toHaveValue("240000");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("replaces the edited line rather than appending another", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<Harness initial={[RENT, { source: "Interest", amount: 15_000_000 }]} onChange={onChange} />);

    await user.click(screen.getByTestId("edit-additional-income-0"));

    const source = screen.getByTestId("additional-income-source");
    await user.clear(source);
    await user.type(source, "Rent from the shop");
    await user.click(screen.getByTestId("additional-income-save"));

    // The index, not the entry: two lines can carry the same source and amount, so identifying
    // the row by its contents would edit whichever matched first.
    expect(onChange).toHaveBeenCalledWith(
      { source: "Rent from the shop", amount: 24_000_000 },
      0
    );

    /*
     * Waiting on the dialog going, not on the new text appearing. The text lands in the same
     * tick as the save, so waiting on it returns instantly — and while the dialog is still in its
     * exit transition the mounted modal keeps `aria-hidden` on everything behind it, leaving the
     * table unreachable.
     */
    await waitFor(() => {
      expect(screen.queryByTestId("additional-income-dialog")).toBeNull();
    });

    expect(screen.getByText("Rent from the shop")).toBeInTheDocument();
    // The old source is gone rather than duplicated...
    expect(screen.queryByText("Rent from a flat")).toBeNull();
    // ...the row count is unchanged (a header plus two lines, not three)...
    expect(screen.getAllByRole("row")).toHaveLength(3);
    // ...and the row that was not edited is untouched.
    expect(screen.getByText("Interest")).toBeInTheDocument();
  });

  it("edits the row that was clicked, not the first one", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(
      <Harness
        initial={[RENT, { source: "Interest", amount: 15_000_000 }]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByTestId("edit-additional-income-1"));

    expect(screen.getByTestId("additional-income-source")).toHaveValue("Interest");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("additional-income-save"));

    expect(onChange).toHaveBeenCalledWith(expect.anything(), 1);
  });

  it("opens an empty dialog for the next add after an edit", async () => {
    const user = userEvent.setup();

    render(<Harness initial={[RENT]} onChange={jest.fn()} />);

    await user.click(screen.getByTestId("edit-additional-income-0"));
    await user.click(screen.getByTestId("additional-income-cancel"));

    // Past the dialog's exit transition, during which a mounted modal keeps the page behind it
    // out of the accessibility tree.
    await waitFor(() => {
      expect(screen.queryByTestId("additional-income-dialog")).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: /add income/i }));

    // Cleared on the way out, or the next add would land on the row just edited.
    expect(screen.getByTestId("additional-income-source")).toHaveValue("");
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
  });

  it("refuses a blank line rather than adding one that says nothing", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<Harness initial={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add income/i }));
    await user.click(screen.getByTestId("additional-income-save"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/say what this income was/i)).toBeInTheDocument();
  });

  it("refuses an amount that is not whole rupees", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(<Harness initial={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add income/i }));
    await user.type(screen.getByTestId("additional-income-source"), "Rent");
    await user.type(screen.getByTestId("additional-income-amount"), "2400.50");
    await user.click(screen.getByTestId("additional-income-save"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/whole number of rupees/i)).toBeInTheDocument();
  });

  it("removes a line by its row", async () => {
    const user = userEvent.setup();

    render(
      <Harness
        initial={[RENT, { source: "Interest", amount: 15_000_000 }]}
        onChange={jest.fn()}
      />
    );

    await user.click(screen.getByTestId("remove-additional-income-0"));

    expect(screen.queryByText("Rent from a flat")).toBeNull();
    expect(screen.getByText("Interest")).toBeInTheDocument();
  });

  it("totals the lines", () => {
    render(
      <AdditionalIncomeSection
        entries={[RENT, { source: "Interest", amount: 15_000_000 }]}
        onChange={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    // Rs 2,40,000 + Rs 1,50,000 = Rs 3,90,000.
    expect(screen.getByTestId("additional-income-total")).toHaveTextContent("3,90,000");
  });
});