import {
  buildPayload,
  buildUpdatePayload,
  emptyValues,
  getChangedKeys,
  getVisibleFields,
  validateForm,
  valuesFromRecord,
} from "@/helpers/recordForm";
import { ExpenseCategory, PaymentMode, RecurrenceFrequency } from "@/types/FinanceTypes";
import type { CrossFieldRule, FieldConfig } from "@/types/RecordFormTypes";

const PAYMENT_MODES = [{ value: "upi", label: "Upi" }];
const FREQUENCIES = [{ value: "monthly", label: "Monthly" }];

const FIELDS: FieldConfig[] = [
  { kind: "text", name: "title", label: "title", required: true, maxLength: 150 },
  { kind: "money", name: "amount", label: "amount", required: true },
  { kind: "money", name: "taxPaid", label: "tax paid", allowZero: true },
  { kind: "percent", name: "rate", label: "rate" },
  { kind: "date", name: "date", label: "date", required: true },
  { kind: "select", name: "category", label: "category", options: PAYMENT_MODES },
  { kind: "switch", name: "isRecurring", label: "recurring" },
  {
    kind: "select",
    name: "recurrenceFrequency",
    label: "frequency",
    required: true,
    options: FREQUENCIES,
    visibleWhen: { name: "isRecurring", equals: true },
  },
];

describe("record form", () => {
  describe("buildPayload", () => {
    it("converts money to integer paise", () => {
      expect(buildPayload(FIELDS, { amount: "2450.50" }).amount).toBe(245050);
    });

    it("sends a percentage as a plain number, never as paise", () => {
      expect(buildPayload(FIELDS, { rate: "8.75" }).rate).toBe(8.75);
    });

    it("omits a blank optional instead of sending null or undefined", () => {
      const payload = buildPayload(FIELDS, { amount: "100" });

      // The body is strict, so a key the contract does not list is a rejection.
      expect("taxPaid" in payload).toBe(false);
      expect("title" in payload).toBe(false);
    });

    it("keeps a legitimate zero", () => {
      expect(buildPayload(FIELDS, { taxPaid: "0" }).taxPaid).toBe(0);
    });

    it("sends a date-only string unshifted", () => {
      expect(buildPayload(FIELDS, { date: "2026-03-15" }).date).toBe("2026-03-15");
    });

    it("trims text", () => {
      expect(buildPayload(FIELDS, { title: "  Groceries  " }).title).toBe("Groceries");
    });

    it("always sends a switch, because false is a real value", () => {
      expect(buildPayload(FIELDS, { isRecurring: false }).isRecurring).toBe(false);
    });
  });

  describe("visibility", () => {
    it("hides a dependent field until its switch is on", () => {
      const names = getVisibleFields(FIELDS, { isRecurring: false }).map((field) => field.name);
      expect(names).not.toContain("recurrenceFrequency");

      const enabled = getVisibleFields(FIELDS, { isRecurring: true }).map((field) => field.name);
      expect(enabled).toContain("recurrenceFrequency");
    });

    it("moves every checkbox to the bottom, whatever order they were declared in", () => {
      const withSwitchFirst: FieldConfig[] = [
        { kind: "switch", name: "isRecurring", label: "recurring" },
        { kind: "text", name: "title", label: "title" },
        { kind: "switch", name: "isEssential", label: "essential" },
        { kind: "text", name: "merchant", label: "merchant" },
      ];

      expect(getVisibleFields(withSwitchFirst, {}).map((field) => field.name)).toEqual([
        "title",
        "merchant",
        "isRecurring",
        "isEssential",
      ]);
    });

    it("keeps every field, just reordered, so none is dropped", () => {
      const names = getVisibleFields(FIELDS, { isRecurring: true }).map((field) => field.name);

      expect(names).toHaveLength(FIELDS.length);
      expect(names[names.length - 1]).toBe("isRecurring");
    });

    it("does not send a hidden field", () => {
      const payload = buildPayload(FIELDS, { isRecurring: false, recurrenceFrequency: "monthly" });
      expect("recurrenceFrequency" in payload).toBe(false);
    });
  });

  describe("validateForm", () => {
    it("requires a required field", () => {
      expect(validateForm(FIELDS, { amount: "100" }).title).toMatch(/required/i);
    });

    it("rejects a rate outside 0 to 100", () => {
      expect(validateForm(FIELDS, { rate: "140" }).rate).toMatch(/between 0 and 100/i);
      expect(validateForm(FIELDS, { rate: "8.75" }).rate).toBeUndefined();
    });

    it("requires the frequency once the switch is on", () => {
      const errors = validateForm(FIELDS, { isRecurring: true });
      expect(errors.recurrenceFrequency).toMatch(/required/i);
    });

    it("does not demand the frequency while the switch is off", () => {
      expect(validateForm(FIELDS, { isRecurring: false }).recurrenceFrequency).toBeUndefined();
    });

    it("enforces a cross-field rule on the field it is attached to", () => {
      const rule: CrossFieldRule = {
        fields: ["title", "amount"],
        // Nonsense, but it is the shape the rule tests.
        isValid: (values) => values.title !== "2000",
        message: "Title must not repeat the amount.",
        attachTo: "title",
      };

      const errors = validateForm(FIELDS, { title: "2000", amount: "10" }, [rule]);
      expect(errors.title).toBe("Title must not repeat the amount.");
    });

    it("lets a field's own message win over a cross-field rule", () => {
      const rule: CrossFieldRule = {
        fields: ["date", "title"],
        isValid: () => false,
        message: "Cross-field message.",
        attachTo: "date",
      };

      // An unparseable date is the more useful thing to tell the user.
      expect(validateForm(FIELDS, { date: "nope" }, [rule]).date).toBe("Choose a date.");
    });
  });

  describe("valuesFromRecord", () => {
    it("renders a fractional rupee amount with two decimals", () => {
      expect(valuesFromRecord({ amount: 245050 }, FIELDS).amount).toBe("2450.50");
      expect(valuesFromRecord({ taxPaid: 0 }, FIELDS).taxPaid).toBe("0");
    });

    it("drops the decimals on a whole rupee amount", () => {
      expect(valuesFromRecord({ amount: 245000 }, FIELDS).amount).toBe("2450");
    });

    it("turns null into an empty string, not the word null", () => {
      expect(valuesFromRecord({ title: null }, FIELDS).title).toBe("");
    });

    it("reads a switch as a boolean", () => {
      expect(valuesFromRecord({ isRecurring: true }, FIELDS).isRecurring).toBe(true);
      expect(valuesFromRecord({ isRecurring: null }, FIELDS).isRecurring).toBe(false);
    });
  });

  describe("partial updates", () => {
    const original = { title: "Groceries", amount: "2450.50", taxPaid: "0" };

    it("sends only the fields that changed", () => {
      const payload = buildUpdatePayload(FIELDS, original, { ...original, title: "Food" });
      expect(payload).toEqual({ title: "Food" });
    });

    it("sends nothing when nothing changed", () => {
      expect(buildUpdatePayload(FIELDS, original, { ...original })).toEqual({});
    });

    it("still converts money in the payload it does send", () => {
      const payload = buildUpdatePayload(FIELDS, original, { ...original, amount: "3000" });
      expect(payload.amount).toBe(300000);
    });

    it("clears a field that has just become hidden", () => {
      // Switching an installment expense to another category must clear the loan
      // type, or the server is left holding a pair it rejects.
      const withDependent: FieldConfig[] = [
        { kind: "select", name: "category", label: "category", options: [{ value: "a", label: "A" }] },
        {
          kind: "select",
          name: "detail",
          label: "detail",
          options: [{ value: "x", label: "X" }],
          visibleWhen: { name: "category", equals: "a" },
        },
      ];

      const payload = buildUpdatePayload(
        withDependent,
        { category: "a", detail: "x" },
        { category: "b", detail: "x" }
      );

      expect(payload).toEqual({ category: "b", detail: null });
    });

    it("does not send a hidden field that was already empty", () => {
      const withDependent: FieldConfig[] = [
        { kind: "select", name: "category", label: "category", options: [{ value: "a", label: "A" }] },
        {
          kind: "select",
          name: "detail",
          label: "detail",
          options: [{ value: "x", label: "X" }],
          visibleWhen: { name: "category", equals: "a" },
        },
      ];

      const payload = buildUpdatePayload(withDependent, { category: "a", detail: "" }, { category: "b" });
      expect("detail" in payload).toBe(false);
    });

    it("detects a switch being turned on", () => {
      const changed = getChangedKeys(FIELDS, { isRecurring: false }, { isRecurring: true });
      expect(changed).toEqual(["isRecurring"]);
    });

    it("does not treat a switch as changed when it is re-sent identically", () => {
      expect(getChangedKeys(FIELDS, { isRecurring: true }, { isRecurring: true })).toEqual([]);
    });
  });

  it("seeds an empty form with an empty string or false per field", () => {
    const values = emptyValues(FIELDS);
    expect(values.title).toBe("");
    expect(values.isRecurring).toBe(false);
  });

  it("uses only enum values the contract defines", () => {
    // Guards against a typo in a field config reaching the wire.
    expect(Object.values(ExpenseCategory)).toContain("loan_repayment");
    expect(Object.values(PaymentMode)).toContain("net_banking");
    expect(Object.values(RecurrenceFrequency)).toContain("quarterly");
  });
});