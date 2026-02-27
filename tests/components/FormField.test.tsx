import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FormField from "@/components/FormField";

const noop = () => {};

describe("FormField", () => {
  describe("input (výchozí typ text)", () => {
    it("zobrazí label", () => {
      render(<FormField label="Název" name="name" value="" onChange={noop} />);
      expect(screen.getByLabelText("Název")).toBeInTheDocument();
    });

    it("input má správné id a name", () => {
      render(<FormField label="L" name="myfield" value="" onChange={noop} />);
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("id", "myfield");
      expect(input).toHaveAttribute("name", "myfield");
    });

    it("zobrazí aktuální hodnotu", () => {
      render(<FormField label="L" name="n" value="hello" onChange={noop} />);
      expect(screen.getByRole("textbox")).toHaveValue("hello");
    });

    it("zobrazí placeholder", () => {
      render(<FormField label="L" name="n" value="" onChange={noop} placeholder="Zadej text…" />);
      expect(screen.getByPlaceholderText("Zadej text…")).toBeInTheDocument();
    });

    it("volá onChange handler při změně", () => {
      const onChange = vi.fn();
      render(<FormField label="L" name="n" value="" onChange={onChange} />);
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "test" } });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("required attribute", () => {
      render(<FormField label="L" name="n" value="" onChange={noop} required />);
      expect(screen.getByRole("textbox")).toBeRequired();
    });
  });

  describe("typ number", () => {
    it("renderuje number input", () => {
      render(<FormField label="Částka" name="amount" type="number" value={100} onChange={noop} />);
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("type", "number");
    });

    it("step a min atributy", () => {
      render(
        <FormField label="L" name="n" type="number" value={0} onChange={noop} step="0.01" min="0" />
      );
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("step", "0.01");
      expect(input).toHaveAttribute("min", "0");
    });
  });

  describe("typ date", () => {
    it("renderuje date input", () => {
      render(<FormField label="Datum" name="date" type="date" value="2026-01-01" onChange={noop} />);
      const input = document.querySelector('input[type="date"]');
      expect(input).toBeInTheDocument();
    });
  });

  describe("typ textarea", () => {
    it("renderuje textarea pro type=textarea", () => {
      render(<FormField label="Poznámky" name="notes" type="textarea" value="text" onChange={noop} />);
      expect(screen.getByRole("textbox").tagName.toLowerCase()).toBe("textarea");
    });

    it("výchozí rows = 3", () => {
      render(<FormField label="L" name="n" type="textarea" value="" onChange={noop} />);
      expect(screen.getByRole("textbox")).toHaveAttribute("rows", "3");
    });

    it("vlastní rows", () => {
      render(<FormField label="L" name="n" type="textarea" value="" onChange={noop} rows={6} />);
      expect(screen.getByRole("textbox")).toHaveAttribute("rows", "6");
    });
  });

  describe("select (options prop)", () => {
    const options = [
      { value: "CZK", label: "Česká koruna" },
      { value: "USD", label: "US Dollar" },
      { value: "EUR", label: "Euro" },
    ];

    it("renderuje select element", () => {
      render(<FormField label="Měna" name="currency" value="CZK" onChange={noop} options={options} />);
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("zobrazí všechny options + výchozí 'Select…'", () => {
      render(<FormField label="Měna" name="currency" value="" onChange={noop} options={options} />);
      expect(screen.getByRole("option", { name: "Select…" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Česká koruna" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "US Dollar" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Euro" })).toBeInTheDocument();
    });

    it("správná vybraná hodnota", () => {
      render(<FormField label="L" name="n" value="EUR" onChange={noop} options={options} />);
      expect(screen.getByRole("combobox")).toHaveValue("EUR");
    });

    it("volá onChange při změně selektu", () => {
      const onChange = vi.fn();
      render(<FormField label="L" name="n" value="CZK" onChange={onChange} options={options} />);
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "USD" } });
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});
