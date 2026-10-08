import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RecordToolbar from "@/components/Records/RecordToolbar/RecordToolbar";
import type { MultiFilter } from "@/components/Records/RecordToolbar/RecordToolbar";
import type { ListQuery } from "@/types/FinanceTypes";

/**
 * MUI's `Select` renders a hidden input carrying the `id`, and an external
 * `<label htmlFor>` does not reach it, so `getByLabelText` cannot see a select at all. That
 * gap is pre-existing and applies to the sort and the multi-selects alike; these helpers look
 * a control up the way its label claims to, by id.
 */
const queryById = (id: string): HTMLElement | null => document.getElementById(id);

const getById = (id: string): HTMLElement => {
  const found = queryById(id);

  if (!found) {
    throw new Error(`no element with id ${id}`);
  }

  return found;
};

/** The panel mounts in a portal, so its contents are not in the tree until the click lands. */
const findById = async (id: string): Promise<HTMLElement> => {
  await waitFor(() => {
    if (!queryById(id)) {
      throw new Error(`no element with id ${id}`);
    }
  });

  return getById(id);
};

const FILTERS: MultiFilter[] = [
  {
    key: "category",
    label: "Category",
    options: [
      { value: "food", label: "Food" },
      { value: "housing", label: "Housing" },
    ],
  },
  {
    key: "paymentMode",
    label: "Payment mode",
    options: [
      { value: "upi", label: "UPI" },
      { value: "card", label: "Card" },
    ],
  },
];

const renderToolbar = (
  query: ListQuery = {},
  overrides: Partial<React.ComponentProps<typeof RecordToolbar>> = {}
) => {
  const onChange = jest.fn();
  const onReset = jest.fn();

  render(
    <RecordToolbar
      query={query}
      sortOptions={[{ value: "createdAt", label: "Newest" }]}
      filters={FILTERS}
      hasActiveFilters={false}
      onChange={onChange}
      onReset={onReset}
      onAdd={jest.fn()}
      addLabel="Add expense"
      {...overrides}
    />
  );

  return { user: userEvent.setup(), onChange, onReset };
};

/** Opens the panel, so a test can go straight to the control it cares about. */
const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId("records-filter-toggle"));
};

describe("the filter button", () => {
  it("sits at the extreme left of the toolbar", () => {
    renderToolbar();

    const toolbar = screen.getByTestId("records-toolbar");
    const index = Array.from(toolbar.children).findIndex(
      (child) => child === screen.getByTestId("records-filter-toggle")
    );

    // First child, so the way into shaping the list is where the eye lands before typing.
    expect(index).toBe(0);
  });

  it("leaves only the actions on the toolbar, and hides everything else behind the button", async () => {
    const { user } = renderToolbar();

    /*
     * Everything that shapes the list is behind the button. A toolbar holding just a way to add
     * something reads as one decision; the previous version read as a control panel with an add
     * button tacked on the end.
     */
    expect(queryById("filter-search")).toBeNull();
    expect(queryById("filter-from")).toBeNull();
    expect(queryById("filter-sort")).toBeNull();
    expect(screen.getByTestId("records-add")).toBeInTheDocument();

    await openPanel(user);

    expect(getById("filter-search")).toBeInTheDocument();
    expect(getById("filter-from")).toBeInTheDocument();
    expect(getById("filter-to")).toBeInTheDocument();
    expect(getById("filter-sort")).toBeInTheDocument();
    expect(getById("filter-category")).toBeInTheDocument();
    expect(getById("filter-paymentMode")).toBeInTheDocument();
  });

  it("toggles the panel shut on a second press", async () => {
    const { user } = renderToolbar();

    await openPanel(user);
    await findById("filter-category");

    await user.click(screen.getByTestId("records-filter-toggle"));

    await waitFor(() => {
      expect(queryById("filter-category")).toBeNull();
    });
  });

  describe("showing that a list is filtered", () => {
    it("says nothing when nothing is chosen", () => {
      renderToolbar();

      // A plain icon button, so an unfiltered list looks untouched.
      expect(screen.queryByTestId("records-filter-count")).toBeNull();
      expect(screen.getByTestId("records-filter-toggle")).toHaveAccessibleName("Filters");
    });

    it("counts the repeatable filters that are on", () => {
      renderToolbar({ category: ["food"], paymentMode: ["upi"] });

      // Two on, so two. Counted per filter rather than per value, because choosing three
      // categories is still one filter.
      expect(screen.getByTestId("records-filter-count")).toHaveTextContent("2");
    });

    it("counts a search, now that search lives behind the button", () => {
      renderToolbar({ search: "rent" });

      // Without this the list would be visibly narrowed while the button showed nothing, which
      // is the one outcome this button exists to prevent.
      expect(screen.getByTestId("records-filter-count")).toHaveTextContent("1");
    });

    it("counts the date range as one filter", () => {
      renderToolbar({ from: "2026-01-01" });

      // From and To are two controls but one range, so "2" would overstate what was chosen.
      expect(screen.getByTestId("records-filter-count")).toHaveTextContent("1");
    });

    it("does not count a sort, which narrows nothing", () => {
      renderToolbar({ sort: "createdAt" });

      // Reordering a list leaves it just as long. Claiming otherwise would be a lie.
      expect(screen.queryByTestId("records-filter-count")).toBeNull();
    });

    it("ignores a filter left with an empty selection", () => {
      renderToolbar({ category: [], paymentMode: ["upi"] }, { hasActiveFilters: true });

      // An empty array is the absence of a choice, not a choice of nothing.
      expect(screen.getByTestId("records-filter-count")).toHaveTextContent("1");
    });

    it("names the count for a screen reader, since the badge is a bare number", () => {
      renderToolbar({ category: ["food"] });

      expect(screen.getByTestId("records-filter-toggle")).toHaveAccessibleName(
        "Filters, 1 active"
      );
    });
  });

  it("reports a chosen value as repeated query keys", async () => {
    const { user, onChange } = renderToolbar();

    await openPanel(user);

    await user.click(await findById("filter-category"));
    await user.click(await screen.findByRole("option", { name: /Food/ }));

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]({})).toEqual({ category: ["food"] });
  });

  describe("the reset", () => {
    it("is not on the toolbar", () => {
      renderToolbar({ category: ["food"] }, { hasActiveFilters: true });

      // Reachable only once the panel is open, which is the point: it is not an advertisement
      // for a control that is usually not needed.
      expect(screen.queryByTestId("records-clear-filters")).toBeNull();
    });

    it("is disabled while there is nothing to clear", async () => {
      const { user } = renderToolbar();

      await openPanel(user);
      await findById("filter-category");

      // A reset that stays live but does nothing when pressed is worse than one that admits it
      // has nothing to do.
      expect(screen.getByTestId("records-clear-filters")).toBeDisabled();
    });

    it("resets once something is chosen", async () => {
      const { user, onReset } = renderToolbar(
        { category: ["food"] },
        { hasActiveFilters: true }
      );

      await openPanel(user);
      await user.click(await screen.findByTestId("records-clear-filters"));

      expect(onReset).toHaveBeenCalled();
    });
  });

  it("opens showing the search already typed", async () => {
    const { user } = renderToolbar({ search: "rent" }, { hasActiveFilters: true });

    await openPanel(user);

    // Otherwise the only record of the search would be the badge, and clearing it from here
    // would be a guess.
    expect(await findById("filter-search")).toHaveValue("rent");
  });
});