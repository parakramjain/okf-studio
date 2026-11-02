(() => {
  const input = document.getElementById("search");
  const sections = [...document.querySelectorAll("main section")];
  const links = [...document.querySelectorAll(".layout nav a")];
  function filter() {
    const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    sections.forEach(section => {
      const match = terms.every(term => section.textContent.toLowerCase().includes(term));
      section.hidden = !match; if (match) count++;
      const link = links.find(link => link.hash === `#${section.id}`); if (link) link.hidden = !match;
    });
    document.getElementById("search-status").textContent = terms.length ? `${count} matching sections · search stays on your device` : "Offline guide · included with your extension";
    document.getElementById("no-results").hidden = count > 0;
  }
  input.addEventListener("input", filter);
  document.getElementById("clear").addEventListener("click", () => { input.value = ""; filter(); input.focus(); });
  function active() { links.forEach(link => { if (link.hash === location.hash) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current"); }); }
  window.addEventListener("hashchange", active); active();
})();
