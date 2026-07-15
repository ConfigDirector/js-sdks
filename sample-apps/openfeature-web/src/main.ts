import { initConfigsTab } from "./configs-tab";
import { initContextTab } from "./context-tab";
import { client } from "./config-director-setup";

const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
const tabPanels = document.querySelectorAll<HTMLElement>(".tab-panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
    tabPanels.forEach((p) => p.classList.toggle("active", p.id === `tab-${target}`));
  });
});

initConfigsTab(client);
initContextTab();
