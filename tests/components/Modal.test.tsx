import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "@/components/Modal";

describe("Modal", () => {
  describe("základní render", () => {
    it("zobrazí title", () => {
      render(
        <Modal title="Přidat holding" onClose={vi.fn()}>
          <p>Obsah</p>
        </Modal>
      );
      expect(screen.getByText("Přidat holding")).toBeInTheDocument();
    });

    it("zobrazí children obsah", () => {
      render(
        <Modal title="T" onClose={vi.fn()}>
          <span>Formulář uvnitř modalu</span>
        </Modal>
      );
      expect(screen.getByText("Formulář uvnitř modalu")).toBeInTheDocument();
    });

    it("zobrazí close tlačítko (×)", () => {
      render(<Modal title="T" onClose={vi.fn()}><div /></Modal>);
      expect(screen.getByRole("button", { name: "×" })).toBeInTheDocument();
    });
  });

  describe("zavírání", () => {
    it("klik na × zavolá onClose", () => {
      const onClose = vi.fn();
      render(<Modal title="T" onClose={onClose}><div /></Modal>);
      fireEvent.click(screen.getByRole("button", { name: "×" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("klik na overlay (backdrop) zavolá onClose", () => {
      const onClose = vi.fn();
      const { container } = render(<Modal title="T" onClose={onClose}><div /></Modal>);
      // Overlay je první div (fixed, inset:0)
      fireEvent.click(container.firstChild as Element);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("klik uvnitř modal boxu NEZAVŘE modal", () => {
      const onClose = vi.fn();
      render(
        <Modal title="Přidat" onClose={onClose}>
          <button>Vnitřní tlačítko</button>
        </Modal>
      );
      // Klik na vnitřní obsah — stopPropagation by měl zabránit zavření
      fireEvent.click(screen.getByText("Vnitřní tlačítko"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("klávesa Escape zavolá onClose", () => {
      const onClose = vi.fn();
      render(<Modal title="T" onClose={onClose}><div /></Modal>);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("jiná klávesa (Enter) nezavře modal", () => {
      const onClose = vi.fn();
      render(<Modal title="T" onClose={onClose}><div /></Modal>);
      fireEvent.keyDown(document, { key: "Enter" });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("cleanup event listeneru", () => {
    it("po unmount neprovede onClose při stisku Escape", () => {
      const onClose = vi.fn();
      const { unmount } = render(<Modal title="T" onClose={onClose}><div /></Modal>);
      unmount();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("prázdné children nehodí chybu", () => {
      expect(() =>
        render(<Modal title="T" onClose={vi.fn()}>{null}</Modal>)
      ).not.toThrow();
    });

    it("vícero dětí se renderuje", () => {
      render(
        <Modal title="T" onClose={vi.fn()}>
          <p>Část 1</p>
          <p>Část 2</p>
        </Modal>
      );
      expect(screen.getByText("Část 1")).toBeInTheDocument();
      expect(screen.getByText("Část 2")).toBeInTheDocument();
    });
  });
});
