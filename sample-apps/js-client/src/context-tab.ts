import type { ConfigDirectorClient } from "@configdirector/client-sdk";

function flashMessage(el: HTMLElement): void {
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2200);
}

export function initContextTab(client: ConfigDirectorClient): void {
  const form = document.getElementById("context-form") as HTMLFormElement;
  const userIdInput = document.getElementById("user-id-input") as HTMLInputElement;
  const userNameInput = document.getElementById("user-name-input") as HTMLInputElement;
  const userRoleInput = document.getElementById("user-role-input") as HTMLInputElement;
  const clearButton = document.getElementById("clear-button") as HTMLButtonElement;
  const savedMessage = document.getElementById("saved-message") as HTMLElement;
  const clearedMessage = document.getElementById("cleared-message") as HTMLElement;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await client.updateContext({
      id: userIdInput.value || undefined,
      name: userNameInput.value || undefined,
      traits: userRoleInput.value ? { role: userRoleInput.value } : undefined,
    });
    flashMessage(savedMessage);
  });

  clearButton.addEventListener("click", async () => {
    userIdInput.value = "";
    userNameInput.value = "";
    userRoleInput.value = "";
    await client.updateContext({});
    flashMessage(clearedMessage);
  });
}
