import { OpenFeature } from "@openfeature/web-sdk";

function flashMessage(el: HTMLElement): void {
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2200);
}

export function initContextTab(): void {
  const form = document.getElementById("context-form") as HTMLFormElement;
  const userIdInput = document.getElementById("user-id-input") as HTMLInputElement;
  const userNameInput = document.getElementById("user-name-input") as HTMLInputElement;
  const userRoleInput = document.getElementById("user-role-input") as HTMLInputElement;
  const clearButton = document.getElementById("clear-button") as HTMLButtonElement;
  const savedMessage = document.getElementById("saved-message") as HTMLElement;
  const clearedMessage = document.getElementById("cleared-message") as HTMLElement;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await OpenFeature.setContext({
      ...(userIdInput.value && { targetingKey: userIdInput.value }),
      ...(userNameInput.value && { name: userNameInput.value }),
      ...(userRoleInput.value && { traits: { role: userRoleInput.value } }),
    });
    flashMessage(savedMessage);
  });

  clearButton.addEventListener("click", async () => {
    userIdInput.value = "";
    userNameInput.value = "";
    userRoleInput.value = "";
    await OpenFeature.setContext({});
    flashMessage(clearedMessage);
  });
}
