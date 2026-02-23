import { expect, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";
import App from "../src/app";

test("renders the main page", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: /tools/i })).toBeInTheDocument();
});
