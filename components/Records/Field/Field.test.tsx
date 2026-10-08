import { fireEvent, render, screen } from "@testing-library/react";
import { Field, FieldGroup } from "@/components/Records/Field/Field";
import { INVESTMENT_FIELDS } from "@/components/Investments/InvestmentsConfig";
import { LOAN_FIELDS } from "@/components/Loans/LoansConfig";
import { getVisibleFields } from "@/helpers/recordForm";
import { InvestmentType } from "@/types/FinanceTypes";
import type { FieldConfig, FormValues } from "@/types/RecordFormTypes";

const renderGroup = (fields: FieldConfig[], values: FormValues = {}) =>
  render(
    <FieldGroup fields={fields} values={values} errors={{}} onChange={jest.fn()} />
  );

/**
 * The fields on screen for a given form state.
 *
 * Passed in by the caller rather than filtered here, because that is how the screen does it:
 * `FieldGroup` draws what it is handed, and `useRecordsScreen` hands it the visible subset.
 */
const shownFor = (values: FormValues): FieldConfig[] =>
  getVisibleFields(INVESTMENT_FIELDS, values);

/** The label as it is drawn, for every field on screen. */
const labelsOnScreen = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll("label")).map(
    (node) => node.textContent ?? ""
  );

describe("required fields are marked", () => {
  it("puts an asterisk on a required field", () => {
    const { container } = renderGroup([
      { kind: "text", name: "title", label: "title", required: true },
    ]);

    expect(labelsOnScreen(container)).toContain("title *");
  });

  it("says nothing about an optional one", () => {
    const { container } = renderGroup([
      { kind: "text", name: "notes", label: "notes" },
    ]);

    /*
     * The mark replaced a "(optional)" suffix on every other field. On a form where most
     * controls are optional the word repeated down the page, and the few that *were* required
     * became the ones you had to look for.
     */
    expect(labelsOnScreen(container)).toEqual(["notes"]);
  });

  it("marks the required and leaves the optional alone, across both real forms", () => {
    for (const fields of [INVESTMENT_FIELDS, LOAN_FIELDS]) {
      const { container, unmount } = renderGroup(fields);
      const labels = labelsOnScreen(container);

      for (const field of fields) {
        if (field.kind === "switch") {
          continue;
        }

        const expected = field.required ? `${field.label} *` : field.label;

        expect(labels).toContain(expected);
        unmount();
      }
    }
  });

  it("never says optional anywhere on a real form", () => {
    const { container } = renderGroup(INVESTMENT_FIELDS);

    expect(container.textContent ?? "").not.toMatch(/optional/i);
  });
});

describe("the message slot", () => {
  it("shows an error when there is one", () => {
    render(
      <Field
        field={{ kind: "text", name: "title", label: "title", required: true }}
        value=""
        error="Title is required."
        onChange={jest.fn()}
      />
    );

    expect(screen.getByText("Title is required.")).toBeInTheDocument();
  });

  it("says nothing when there is no error", () => {
    const { container } = render(
      <Field
        field={{ kind: "text", name: "title", label: "title", required: true }}
        value="Home loan"
        onChange={jest.fn()}
      />
    );

    // No guidance text survives on any field, so a correct field simply says nothing.
    expect(container.textContent ?? "").not.toMatch(/What you call/);
  });
});

describe("a date box", () => {
  const startDate = { kind: "date", name: "startDate", label: "start date" } as const;

  it("asks for the day first", () => {
    render(<Field field={startDate} value="2026-03-04" onChange={jest.fn()} />);

    /*
     * `03/04/2026` under MUI's own `MM/DD/YYYY` default reads as April the third to anyone who
     * writes dates the other way round — and a start date read a month early is not noticed
     * until a schedule has been built on it.
     */
    expect(screen.getByLabelText(/start date/)).toHaveValue("04/03/2026");
  });

  it("says the same in its placeholder, so an empty box states the order", () => {
    render(<Field field={startDate} value="" onChange={jest.fn()} />);

    expect(screen.getByPlaceholderText("dd/mm/yyyy")).toBeInTheDocument();
  });

  it("still hands the form the same YYYY-MM-DD it always did", () => {
    /*
     * The format is a drawing, not a change of contract. The value the rest of the form holds,
     * and every payload built from it, is unaffected.
     */
    const onChange = jest.fn();

    render(<Field field={startDate} value="2026-03-04" onChange={onChange} />);

    const input = screen.getByLabelText(/start date/);

    fireEvent.change(input, { target: { value: "05/03/2026" } });

    expect(onChange).toHaveBeenCalledWith("startDate", "2026-03-05");
  });

  it("uses the same order on every date field the forms declare", () => {
    // Two forms, different routes, one convention — checked rather than assumed.
    for (const fields of [INVESTMENT_FIELDS, LOAN_FIELDS]) {
      for (const field of fields.filter((entry) => entry.kind === "date")) {
        const { container, unmount } = render(
          <FieldGroup fields={[field]} values={{}} errors={{}} onChange={jest.fn()} />
        );

        expect(
          container.querySelector("input")?.getAttribute("placeholder")
        ).toBe("dd/mm/yyyy");
        unmount();
      }
    }
  });
});

describe("a field that waits on another", () => {
  const endDate = INVESTMENT_FIELDS.find((field) => field.name === "endDate");

  it("is disabled while the field it counts from is empty", () => {
    const values: FormValues = { type: InvestmentType.FD, startDate: "" };
    const { container } = renderGroup(shownFor(values), values);

    // A date with nothing to count forward from is not a term. Worked out by the form from the
    // two field names, so no caller has to remember which control depends on which.
    expect(container.querySelector("#field-endDate")).toBeDisabled();
  });

  it("is enabled as soon as that field holds a value", () => {
    const values: FormValues = {
      type: InvestmentType.FD,
      startDate: "2026-01-05",
    };
    const { container } = renderGroup(shownFor(values), values);

    expect(container.querySelector("#field-endDate")).toBeEnabled();
  });

  it("is not on screen at all for a holding that has no term", () => {
    const values: FormValues = {
      type: InvestmentType.SAVINGS,
      startDate: "2026-01-05",
    };
    const { container } = renderGroup(shownFor(values), values);

    // A balance accrues and a share price has no maturity, so there is nothing for it to be
    // enabled against.
    expect(container.querySelector("#field-endDate")).toBeNull();
  });

  it("carries the disabled flag the group decided on", () => {
    render(<Field field={endDate!} value="" onChange={jest.fn()} disabled />);

    expect(screen.getByLabelText(/end date/)).toBeDisabled();
  });
});