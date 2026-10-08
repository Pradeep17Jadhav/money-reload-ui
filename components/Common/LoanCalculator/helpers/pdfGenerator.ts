import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getMonthsToYearMonths } from "@/helpers/helpers";
import {
  columnsWithPrice,
  getDesktopColumns,
  TableColumnKeys,
} from "../constants";
import { formatRate, getPrintableMonthYear } from "./loan";
import {
  AmortisationTableFrequency,
  AmortisationRow,
  LoanData,
} from "../../../../types/Loan/LoanTypes";

const getStartMonth = (loanData: LoanData) => {
  const month = getPrintableMonthYear(
    AmortisationTableFrequency.Monthly,
    loanData.monthYear
  );
  const year = getPrintableMonthYear(
    AmortisationTableFrequency.Yearly,
    loanData.monthYear,
    false,
    true
  );
  return `${month} ${year}`;
};

export const generatePDF = async (
  amortisationData: AmortisationRow[],
  loanData: LoanData,
  tableFrequency: AmortisationTableFrequency,
  formatAmount: (amount: number, decimals?: number) => string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tablePadding = 20;
  const usableWidth = pageWidth - tablePadding * 2;
  const robotoFont = await getRobotoFont();
  const hasPrepayments = loanData.hasPrepayments;

  doc.addFileToVFS("Roboto.ttf", robotoFont);
  doc.addFont("Roboto.ttf", "Roboto", "normal");
  doc.setFont("helvetica", "bold").setFontSize(18);
  const title = "MoneyReload";
  doc.text(title, (pageWidth - doc.getTextWidth(title)) / 2, 15);
  doc.setTextColor("#0089E7").setFontSize(12);
  doc.textWithLink(
    "www.moneyreload.com",
    (pageWidth - doc.getTextWidth("www.moneyreload.com")) / 2,
    22,
    { url: "https://www.moneyreload.com" }
  );

  doc.setTextColor(80, 80, 80).setFontSize(12).text("Loan Details", 20, 35);

  const loanTablePrepaymentBody = hasPrepayments
    ? [
        [
          "Tenure With Prepayments (Months)",
          `${loanData.tenureWithPrepaymentMonths} Months`,
        ],
        [
          "Tenure With Prepayments (Years)",
          getMonthsToYearMonths(loanData.tenureWithPrepaymentMonths),
        ],
        ["Total Prepayments", formatAmount(loanData.totalPrepayments)],
        [
          "Principal Amount (excluding prepayments)",
          formatAmount(loanData.totalPrincipalPaid),
        ],
      ]
    : [];

  const loanTableBody = [
    ["Loan Amount", formatAmount(loanData.loanAmount)],
    ["Interest Rate", `${loanData.rateOfInterest}%`],
    ["EMI (Monthly)", formatAmount(loanData.emi)],
    ["Start Month", getStartMonth(loanData)],
    [
      `${hasPrepayments ? "Original " : ""}Tenure (Months)`,
      `${loanData.tenureMonths} Months`,
    ],
    [
      `${hasPrepayments ? "Original " : ""}Tenure (Years)`,
      getMonthsToYearMonths(loanData.tenureMonths),
    ],
    ...loanTablePrepaymentBody,
    ["Interest Amount", formatAmount(loanData.totalInterestPaid)],
    [
      `Total Repayment ${hasPrepayments ? "(excluding prepayments)" : ""}`,
      formatAmount(loanData.totalInterestPaid + loanData.totalPrincipalPaid),
    ],
    ...(hasPrepayments
      ? [
          [
            "Total Repayment With Prepayments",
            formatAmount(
              loanData.totalInterestPaid +
                loanData.totalPrincipalPaid +
                loanData.totalPrepayments
            ),
          ],
        ]
      : []),
  ];

  autoTable(doc, {
    startY: 38,
    body: loanTableBody,
    theme: "grid",
    styles: { font: "Roboto", fontSize: 9, halign: "left" },
    columnStyles: { 0: { font: "helvetica", fontStyle: "bold" } },
    margin: { left: tablePadding, right: tablePadding },
  });

  doc.setTextColor(80, 80, 80).setFontSize(12).setFont("helvetica");
  doc.text(
    `Loan Amortisation Table ${
      tableFrequency === AmortisationTableFrequency.Monthly
        ? "(Monthly)"
        : "(Yearly)"
    }`,
    20,
    52 + loanTableBody.length * 7
  );

  const desktopColumns = getDesktopColumns(hasPrepayments);
  const headers = desktopColumns.map((col) => {
    if (col.key === "year") {
      return tableFrequency === AmortisationTableFrequency.Monthly
        ? "Month"
        : "Year";
    }
    return col.label;
  });
  const rows = amortisationData.map((row) =>
    desktopColumns.map((col) => {
      if (columnsWithPrice.includes(col.key))
        return formatAmount(row[col.key as keyof AmortisationRow]);
      if (col.key === TableColumnKeys.LOAN_PAID_PERCENT)
        return `${row[col.key as keyof AmortisationRow].toFixed(2)}%`;
      if (col.key === TableColumnKeys.ROI) return `${formatRate(row.interestRate)}%`;
      if (col.key === TableColumnKeys.YEAR) {
        return getPrintableMonthYear(
          tableFrequency,
          row[col.key as keyof AmortisationRow]
        );
      }
      return row[col.key as keyof AmortisationRow];
    })
  );

  const columnCount = headers.length;
  const columnWidths = getColumnWidths(usableWidth, columnCount);
  const columnStyles: Record<number, { cellWidth: number }> =
    columnWidths.reduce((acc, width, index) => {
      acc[index] = { cellWidth: width };
      return acc;
    }, {} as Record<number, { cellWidth: number }>);

  autoTable(doc, {
    startY: 55 + loanTableBody.length * 7,
    head: [headers],
    body: rows,
    theme: "grid",
    styles: { halign: "right", fontSize: 8, font: "Roboto" },
    headStyles: {
      fillColor: [0, 137, 231],
      textColor: [255, 255, 255],
      font: "helvetica",
      fontStyle: "bold",
    },
    columnStyles,
    margin: { left: tablePadding, right: tablePadding },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i).setFontSize(10);
    doc.textWithLink(
      "Generated by www.moneyreload.com",
      14,
      pageHeight - 10,
      { url: "https://www.moneyreload.com" }
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 40, pageHeight - 10);
  }
  doc.save("loan_amortisation.pdf");
};

const getRobotoFont = async () => {
  const fontBuffer = await fetch("/fonts/Roboto.ttf").then((res) =>
    res.arrayBuffer()
  );
  let binary = "";
  const bytes = new Uint8Array(fontBuffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const getColumnWidths = (
  usableWidth: number,
  columnCount: number,
  smallColumnRatio = 0.75
) => {
  if (columnCount < 3) throw new Error("At least 3 columns are required");

  const largeColumnCount = columnCount - 2;
  const largeColumnWidth =
    usableWidth / (largeColumnCount + 2 * smallColumnRatio);
  const smallColumnWidth = largeColumnWidth * smallColumnRatio;

  return Array.from({ length: columnCount }, (_, i) =>
    i === 0 || i === columnCount - 1 ? smallColumnWidth : largeColumnWidth
  );
};
