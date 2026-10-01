import samplePageHtml from "../index.html?raw";

export const renderSamplePage = () => {
  const page = new DOMParser().parseFromString(samplePageHtml, "text/html");
  document.body.innerHTML = page.body.innerHTML;
};

export const configValueText = (key: string) =>
  document.querySelector(`[data-config-key="${key}"] .config-value`)?.textContent;

export const input = (id: string) => document.getElementById(id) as HTMLInputElement;

export const isShown = (id: string) => !document.getElementById(id)!.classList.contains("hidden");
