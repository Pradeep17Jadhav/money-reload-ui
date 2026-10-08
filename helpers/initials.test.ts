import { getInitials } from "@/helpers/initials";

describe("getInitials", () => {
  it("takes one initial from each name part when both are present", () => {
    expect(getInitials("Probe", "One")).toBe("PO");
    expect(getInitials("ada", "lovelace")).toBe("AL");
  });

  it("takes the first two characters of the first name when there is no last name", () => {
    expect(getInitials("Ada", "")).toBe("AD");
    expect(getInitials("Ad", "")).toBe("AD");
  });

  it("falls back to the last name when that is all there is", () => {
    expect(getInitials("", "One")).toBe("ON");
  });

  it("never leaves the avatar blank while something has been typed", () => {
    expect(getInitials("A", "")).toBe("A");
    expect(getInitials("", "B")).toBe("B");
  });

  it("returns an empty string only when nothing has been typed", () => {
    expect(getInitials("", "")).toBe("");
    expect(getInitials("   ", "  ")).toBe("");
  });

  it("ignores surrounding whitespace", () => {
    expect(getInitials("  Probe  ", "  One  ")).toBe("PO");
  });
});