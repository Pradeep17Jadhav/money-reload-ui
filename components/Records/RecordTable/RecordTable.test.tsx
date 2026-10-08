import { render, screen } from "@testing-library/react";

import RecordTable from "@/components/Records/RecordTable/RecordTable";
import type { TableColumn } from "@/components/Records/RecordTable/RecordTable";

type Loan = { id: string; lender: string };

const COLUMNS: TableColumn<Loan>[] = [
  { key: "lender", header: "Lender", render: (loan) => loan.lender },
];

const renderTable = (items: Loan[]) =>
  render(
    <RecordTable
      columns={COLUMNS}
      items={items}
      getId={(loan) => loan.id}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
      emptyMessage="No loans yet"
      caption="loan"
    />
  );

describe("the table caption", () => {
  it("is in the document, hidden from view", () => {
    renderTable([{ id: "1", lender: "Bank" }]);

    /*
     * A caption is the table's accessible name, and nothing else on these screens names the
     * table. It stays in the DOM for that reason alone - the visible version was the resource
     * name in grey text above the headers, repeating the page and costing a line of height.
     */
    const caption = screen.getByText("loan");

    expect(caption.tagName).toBe("CAPTION");
    expect(caption.closest("table")).toBe(screen.getByTestId("records-table"));
  });

  it("keeps the caption when a screen reader walks the rows", () => {
    renderTable([{ id: "1", lender: "Bank" }]);

    // Same string the row buttons use, so the table and its actions agree on what this is.
    expect(screen.getByText("loan")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit loan row")).toBeInTheDocument();
  });

  it("does not render at all when there is nothing to caption", () => {
    renderTable([]);

    // With no table there is nothing to name, and the empty message says it all.
    expect(screen.queryByText("loan")).toBeNull();
    expect(screen.getByTestId("records-empty")).toHaveTextContent("No loans yet");
  });
});