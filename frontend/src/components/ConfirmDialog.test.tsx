import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(() => cleanup());

function renderDialog(onClose = vi.fn()) {
  render(<ConfirmDialog open title="Delete this?" description="It cannot be undone." confirmLabel="Delete" onConfirm={vi.fn()} onClose={onClose} />);
  return onClose;
}

describe("ConfirmDialog", () => {
  it("starts on the safe button and closes with Escape", async () => {
    const onClose = renderDialog();
    expect(screen.getByRole("button", { name: "Keep history" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside the dialog", async () => {
    renderDialog();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
  });
});
