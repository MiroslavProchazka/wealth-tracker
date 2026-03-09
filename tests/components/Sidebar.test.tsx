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
      expect(screen.getByText("Osobní finance")).toBeInTheDocument();
    });

    it("zobrazí footer se statusem Evolu", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      expect(screen.getByText("Stav Evolu")).toBeInTheDocument();
    });

    it("footer zobrazí fallback badge s neznámou hodnotou", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("footer status badge používá neutrální text labelu", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      const statusLabel = screen.getByText("Stav Evolu");
      expect(statusLabel).toHaveStyle({ color: "var(--text-2)" });
    });
  });

  describe("navigační položky", () => {
    beforeEach(() => {
      mockUsePathname.mockReturnValue("/");
    });

    it("renderuje přesně 16 navigačních odkazů (8 desktop + 8 mobile)", () => {
      render(<Sidebar />);
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(16);
    });

    const navItems = [
      { label: "Dashboard", href: "/" },
      { label: "Crypto", href: "/crypto" },
      { label: "Akcie", href: "/stocks" },
      { label: "Nemovitosti", href: "/property" },
      { label: "Spoření", href: "/savings" },
      { label: "Historie", href: "/history" },
      { label: "Účet", href: "/account", exact: true },
      { label: "Nastavení", href: "/settings", exact: true },
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
      // Sidebar renderuje linky dvakrát (desktop + mobile) — bereme první (desktop)
      const cryptoLink = screen.getAllByRole("link", { name: /^Crypto$/ })[0];
      expect(cryptoLink).toHaveStyle({ fontWeight: 600 });
    });

    it("neaktivní odkaz má fontWeight 400", () => {
      mockUsePathname.mockReturnValue("/crypto");
      render(<Sidebar />);
      const dashLink = screen.getAllByRole("link", { name: /Dashboard/ })[0];
      expect(dashLink).toHaveStyle({ fontWeight: 400 });
    });

    it("Dashboard aktivní na '/'", () => {
      mockUsePathname.mockReturnValue("/");
      render(<Sidebar />);
      const dashLink = screen.getAllByRole("link", { name: /Dashboard/ })[0];
      expect(dashLink).toHaveStyle({ fontWeight: 600 });
    });

    it("na /property je aktivní pouze Property", () => {
      mockUsePathname.mockReturnValue("/property");
      render(<Sidebar />);
      const propertyLink = screen.getAllByRole("link", { name: /Nemovitosti/ })[0];
      const cryptoLink = screen.getAllByRole("link", { name: /^Crypto$/ })[0];
      expect(propertyLink).toHaveStyle({ fontWeight: 600 });
      expect(cryptoLink).toHaveStyle({ fontWeight: 400 });
    });

    it("aktivní odkaz má gradient pozadí (zvýrazněno)", () => {
      mockUsePathname.mockReturnValue("/stocks");
      render(<Sidebar />);
      const stocksLink = screen.getAllByRole("link", { name: /Akcie/ })[0];
      const bg = (stocksLink as HTMLElement).style.background;
      expect(bg).toBeTruthy();
      expect(bg).not.toBe("transparent");
      expect(bg).toMatch(/gradient/);
    });

    it("neaktivní odkaz má transparentní pozadí", () => {
      mockUsePathname.mockReturnValue("/stocks");
      render(<Sidebar />);
      const cryptoLink = screen.getAllByRole("link", { name: /^Crypto$/ })[0];
      expect(cryptoLink).toHaveStyle({ background: "transparent" });
    });
  });

  describe("ikony v navigaci", () => {
    beforeEach(() => {
      mockUsePathname.mockReturnValue("/");
    });

    it("každý nav item má SVG ikonu", () => {
      render(<Sidebar />);
      // 2 nav elementy (desktop + mobile), každý má 8 SVG ikon → celkem 16
      const svgs = document.querySelectorAll("nav svg");
      expect(svgs.length).toBe(16);
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
