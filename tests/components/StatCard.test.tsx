import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCard from "@/components/StatCard";

describe("StatCard", () => {
  describe("základní render", () => {
    it("zobrazí label a value", () => {
      render(<StatCard label="Net Worth" value="1 234 567 Kč" />);
      expect(screen.getByText("Net Worth")).toBeInTheDocument();
      expect(screen.getByText("1 234 567 Kč")).toBeInTheDocument();
    });

    it("zobrazí ikonu když je předána", () => {
      render(<StatCard label="Crypto" value="500 000 Kč" icon="₿" />);
      expect(screen.getByText("₿")).toBeInTheDocument();
    });

    it("nezobrazí ikonu bez prop", () => {
      render(<StatCard label="Crypto" value="500 000 Kč" />);
      expect(screen.queryByText("₿")).not.toBeInTheDocument();
    });
  });

  describe("sub text (sekundární info)", () => {
    it("zobrazí sub text", () => {
      render(<StatCard label="Label" value="100 Kč" sub="+5.00 %" />);
      expect(screen.getByText("+5.00 %")).toBeInTheDocument();
    });

    it("nezobrazí sub text bez prop", () => {
      render(<StatCard label="Label" value="100 Kč" />);
      expect(screen.queryByText("%")).not.toBeInTheDocument();
    });

    it("kladné subPositive → zelená barva", () => {
      render(<StatCard label="L" value="V" sub="+10 %" subPositive={true} />);
      const subEl = screen.getByText("+10 %");
      expect(subEl).toHaveStyle({ color: "var(--green)" });
    });

    it("záporné subPositive → červená barva", () => {
      render(<StatCard label="L" value="V" sub="-5 %" subPositive={false} />);
      const subEl = screen.getByText("-5 %");
      expect(subEl).toHaveStyle({ color: "var(--red)" });
    });

    it("subPositive undefined → muted barva", () => {
      render(<StatCard label="L" value="V" sub="n/a" />);
      const subEl = screen.getByText("n/a");
      expect(subEl).toHaveStyle({ color: "var(--text-2)" });
    });
  });

  describe("accent (barevná linka nahoře)", () => {
    it("accent renderuje barevný top line element", () => {
      const { container } = render(
        <StatCard label="L" value="V" accent="#3b82f6" />
      );
      const card = container.firstChild as HTMLElement;
      // Accent je absolutně pozicovaný div nahoře na kartě
      const divs = Array.from(card.querySelectorAll("div")) as HTMLElement[];
      const accentLine = divs.find((el) => el.style.position === "absolute");
      expect(accentLine).toBeTruthy();
    });

    it("bez accent nemá top line element", () => {
      const { container } = render(<StatCard label="L" value="V" />);
      const card = container.firstChild as HTMLElement;
      const divs = Array.from(card.querySelectorAll("div")) as HTMLElement[];
      const accentLine = divs.find((el) => el.style.position === "absolute");
      expect(accentLine).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("prázdné value", () => {
      render(<StatCard label="Label" value="" />);
      expect(screen.getByText("Label")).toBeInTheDocument();
    });

    it("dlouhý text ve value", () => {
      const longValue = "1 234 567 890 123 Kč";
      render(<StatCard label="L" value={longValue} />);
      expect(screen.getByText(longValue)).toBeInTheDocument();
    });

    it("emoji v ikoně", () => {
      render(<StatCard label="L" value="V" icon="🏠" />);
      expect(screen.getByText("🏠")).toBeInTheDocument();
    });
  });
});
