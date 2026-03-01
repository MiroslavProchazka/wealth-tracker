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

    it("footer zobrazí 'Synced via Evolu'", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      expect(screen.getByText("Synced via Evolu")).toBeInTheDocument();
    });

    it("footer sync status má zelený text", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      const syncText = screen.getByText("Synced via Evolu");
      expect(syncText).toHaveStyle({ color: "var(--green)" });
    });
  });

  describe("navigační položky", () => {
    beforeEach(() => {
      mockUsePathname.mockReturnValue("/");
    });

    it("renderuje přesně 7 navigačních odkazů", () => {
      render(<Sidebar />);
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(7);
    });

    const navItems = [
      { label: "Dashboard", href: "/" },
      { label: "Crypto", href: "/crypto" },
      { label: "Stocks", href: "/stocks" },
      { label: "Property", href: "/property" },
      { label: "Savings", href: "/savings" },
      { label: "History", href: "/history" },
      { label: "Account", href: "/settings", exact: true },
    ];

    it.each(navItems)("$label má href '$href'", ({ href }) => {
      render(<Sidebar />);
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

    it("aktivní odkaz má gradient pozadí (zvýrazněno)", () => {
      mockUsePathname.mockReturnValue("/stocks");
      render(<Sidebar />);
      const stocksLink = screen.getByRole("link", { name: /Stocks/ });
      const bg = (stocksLink as HTMLElement).style.background;
      expect(bg).toBeTruthy();
      expect(bg).not.toBe("transparent");
      expect(bg).toMatch(/gradient/);
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
      expect(svgs.length).toBe(7);
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
