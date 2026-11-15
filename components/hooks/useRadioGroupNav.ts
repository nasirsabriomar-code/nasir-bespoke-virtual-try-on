"use client";

import type { KeyboardEvent } from "react";

export function handleRadioGroupKeyDown(event: KeyboardEvent<HTMLElement>) {
  const { key } = event;
  if (
    key !== "ArrowRight" &&
    key !== "ArrowDown" &&
    key !== "ArrowLeft" &&
    key !== "ArrowUp" &&
    key !== "Home" &&
    key !== "End"
  ) {
    return;
  }

  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'),
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-disabled") !== "true",
  );

  if (radios.length === 0) return;

  const currentIndex = radios.findIndex(
    (radio) => radio === document.activeElement || radio.contains(document.activeElement),
  );
  if (currentIndex === -1 && key !== "Home" && key !== "End") return;

  let nextIndex = currentIndex;
  if (key === "ArrowRight" || key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % radios.length;
  } else if (key === "ArrowLeft" || key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + radios.length) % radios.length;
  } else if (key === "Home") {
    nextIndex = 0;
  } else if (key === "End") {
    nextIndex = radios.length - 1;
  }

  event.preventDefault();
  const target = radios[nextIndex];
  target.focus();
  target.click();
}
