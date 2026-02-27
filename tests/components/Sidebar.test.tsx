import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

// usePathname je mockován v tests/setup.ts
const mockUsePathname = vi.mocked(usePathname);

describe("Sidebar", () => {
  describe("brand / logo", () => {
    it("zobrazí 'WealthTracker'", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      expect(screen.getByText(/WealthTracker/i)).toBeInTheDocument();
    });

    it("zobrazí 'Personal Finance' podtitulek", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      expect(screen.getByText("Personal Finance")).toBeInTheDocument();
    });

    it("zobrazí footer se statusem synchronizace", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      expect(screen.getByText(/Synced/)).toBeInTheDocument();
    });
  });

  describe("navigační položky", () => {
    beforeEach(() => {
      mockUsePathname.mockReturnValue("/");
    });

    it("renderuje přesně 10 navigačních odkazů", () => {
      render(<Sidebar />);
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(10);
    });

    const navItems = [
      { label: "Dashboard", href: "/" },
      { label: "Crypto", href: "/crypto" },
      { label: "Stocks", href: "/stocks" },
      { label: "Property", href: "/property" },
      { label: "Receivables", href: "/receivables" },
      { label: "Savings", href: "/savings" },
      { label: "Bank Accounts", href: "/accounts" },
      { label: "Goals", href: "/goals" },
      { label: "History", href: "/history" },
      { label: "Account", href: "/settings", exact: true },
    ];

    it.each(navItems)("$label má href '$href'", ({ href }) => {
      render(<Sidebar />);
      // Hledáme přes href — vyhne se ambiguitě "Account" vs "Bank Accounts"
      const links = screen.getAllByRole("link");
      const link = links.find((el) => el.getAttribute("href") === href);
      expect(link).toBeDefined();
      expect(link).toHaveAttribute("href", href);
    });
  });

  describe("aktivní route", () => {
    it("aktivní odkaz má vyšší fontWeight (600)", () => {
      mockUsePathname.mockReturnValue("/crypto");
      render(<Sidebar />);
      const cryptoLink = screen.getByRole("link", { name: /Crypto/ });
      expect(cryptoLink).toHaveStyle({ fontWeight: 600 });
    });

    it("neaktivní odkaz má fontWeight 400", () => {
      mockUsePathname.mockReturnValue("/crypto");
      render(<Sidebar />);
      const dashLink = screen.getByRole("link", { name: /Dashboard/ });
      expect(dashLink).toHaveStyle({ fontWeight: 400 });
    });

    it("Dashboard aktivní na '/'", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      const dashLink = screen.getByRole("link", { name: /Dashboard/ });
      expect(dashLink).toHaveStyle({ fontWeight: 600 });
    });

    it("na /property je aktivní pouze Property", () => {
      mockUsePathname.mockReturnValue("/property");
      render(<Sidebar />);
      const propertyLink = screen.getByRole("link", { name: /Property/ });
      const cryptoLink = screen.getByRole("link", { name: /Crypto/ });
      expect(propertyLink).toHaveStyle({ fontWeight: 600 });
      expect(cryptoLink).toHaveStyle({ fontWeight: 400 });
    });

    it("aktivní odkaz má zvýrazněné pozadí", () => {
      mockUsePathname.mockReturnValue("/stocks");
      render(<Sidebar />);
      const stocksLink = screen.getByRole("link", { name: /Stocks/ });
      expect(stocksLink).toHaveStyle({ background: "var(--surface-2)" });
    });

    it("neaktivní odkaz má transparentní pozadí", () => {
      mockUsePathname.mockReturnValue("/stocks");
      render(<Sidebar />);
      const cryptoLink = screen.getByRole("link", { name: /Crypto/ });
      expect(cryptoLink).toHaveStyle({ background: "transparent" });
    });
  });

  describe("ikony v navigaci", () => {
    beforeEach(() => {
      mockUsePathname.mockReturnValue("/");
    });

    it("každý nav item má SVG ikonu", () => {
      render(<Sidebar />);
      const svgs = document.querySelectorAll("nav svg");
      expect(svgs.length).toBe(10);
    });

    it("SVG ikony mají správné rozměry (16×16)", () => {
      render(<Sidebar />);
      const svgs = document.querySelectorAll("nav svg");
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute("width", "16");
        expect(svg).toHaveAttribute("height", "16");
      });
    });
  });
});
