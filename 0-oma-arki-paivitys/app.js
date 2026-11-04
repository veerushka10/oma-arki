"use strict";

const KEY = "oma-arki-v1";
const weekdays = ["ma", "ti", "ke", "to", "pe", "la", "su"];
const weekdayNames = ["Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai", "Sunnuntai"];
const emptyData = () => ({ version: 1, recipes: [], meals: {}, shopping: [], tasks: [], completed: {} });
const app = document.querySelector("#app");
let data;
let tab = "today";
let selectedDate = dateKey(new Date());
let weekStart = monday(new Date());
let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let recipeCategory = "";
let toastTimer;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fromKey(key) {
  const [year, monthNumber, day] = key.split("-").map(Number);
  return new Date(year, monthNumber - 1, day);
}
function addDays(date, n) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + n);
  return result;
}
function monday(date) { return addDays(date, -((date.getDay() + 6) % 7)); }
function niceDate(key, opts = { weekday: "long", day: "numeric", month: "long" }) {
  return fromKey(key).toLocaleDateString("fi-FI", opts);
}
function id() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function showToast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 4000);
}
function isValidData(value) {
  const isString = v => typeof v === "string";
  const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const isDate = v => isString(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && dateKey(fromKey(v)) === v;
  return isObject(value) && value.version === 1 &&
    Array.isArray(value.recipes) && value.recipes.every(r => isObject(r) && isString(r.id) && isString(r.name) && isString(r.url) && isString(r.ingredients) && isString(r.notes) &&
      (r.category === undefined || isString(r.category)) && (r.importId === undefined || isString(r.importId)) &&
      (r.links === undefined || (Array.isArray(r.links) && r.links.every(link => isObject(link) && isString(link.url) && isString(link.label))))) &&
    isObject(value.meals) && Object.entries(value.meals).every(([date, recipeId]) => isDate(date) && isString(recipeId)) &&
    Array.isArray(value.shopping) && value.shopping.every(i => isObject(i) && isString(i.id) && isString(i.text) && typeof i.checked === "boolean") &&
    Array.isArray(value.tasks) && value.tasks.every(t => isObject(t) && isString(t.id) && isString(t.name) && ((t.type === "once" && isDate(t.date)) || (t.type === "weekly" && Number.isInteger(t.weekday) && t.weekday >= 0 && t.weekday <= 6))) &&
    isObject(value.completed) && Object.entries(value.completed).every(([key, done]) => isString(key) && typeof done === "boolean");
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch { alert("Tallennus puhelimeen epäonnistui. Muutokset ovat vain tässä avoimessa näkymässä. Ota varmuuskopio Asetuksista."); return false; }
}
function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyData();
  const parsed = JSON.parse(raw);
  if (!isValidData(parsed)) throw new Error("Tallennettu tieto ei ole odotetussa muodossa.");
  return parsed;
}
try { data = load(); }
catch {
  app.innerHTML = "<div class='card'><h2>Tietoja ei voitu avata</h2><p>Tallennettu tieto voi olla vaurioitunut tai tallennustila ei ole käytettävissä. Tietoja ei ole korvattu. Kokeile avata sovellus uudelleen.</p></div>";
  throw new Error("Oma arki: tallennettuja tietoja ei voitu lukea.");
}
function saveRender(message) {
  const saved = save();
  render();
  if (message && saved) showToast(message);
}
function modal(content, bind) {
  const old = document.querySelector("dialog");
  if (old) old.remove();
  const dialog = document.createElement("dialog");
  dialog.innerHTML = content;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
  bind?.(dialog);
  dialog.showModal();
}
function linkFor(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch { return ""; }
}
function tasksFor(key) {
  const day = (fromKey(key).getDay() + 6) % 7;
  return data.tasks.filter(task => task.type === "once" ? task.date === key : task.weekday === day);
}
function completedKey(task, date) { return `${task.id}|${date}`; }
function taskRows(tasks, date) {
  if (!tasks.length) return "<div class='empty'>Ei tehtäviä tälle päivälle. Tilaa hengittää 🌿</div>";
  return tasks.map(task => `<div class="item row"><input class="check" type="checkbox" data-check-task="${esc(task.id)}" data-date="${esc(date)}" ${data.completed[completedKey(task, date)] ? "checked" : ""} aria-label="Merkitse ${esc(task.name)} tehdyksi"><span class="grow ${data.completed[completedKey(task, date)] ? "done" : ""}">${esc(task.name)}<br><span class="muted">${task.type === "weekly" ? "Toistuu viikoittain" : "Kuukauden tehtävä"}</span></span><button class="plain" data-edit-task="${esc(task.id)}" aria-label="Muokkaa tehtävää ${esc(task.name)}">Muokkaa</button></div>`).join("");
}
function renderToday() {
  const today = dateKey(new Date());
  const recipe = data.recipes.find(item => item.id === data.meals[today]);
  return `<section class="card soft"><span class="eyebrow">${esc(niceDate(today))}</span><h2 style="margin-top:8px">Rauhallisesti, yksi asia kerrallaan.</h2><p class="hint">Kaikkea ei tarvitse tehdä tänään.</p></section>
    <div class="heading"><h2>Tämän päivän ruoka</h2><button class="plain" data-go="meals">Suunnittele →</button></div>
    <section class="card">${recipe ? `<strong>${esc(recipe.name)}</strong> <button class="plain" data-view-recipe="${esc(recipe.id)}">Avaa</button>` : "<p class='muted'>Ei vielä suunniteltua ruokaa.</p>"}</section>
    <div class="heading"><h2>Tämän päivän tehtävät</h2><button class="plain" data-go="tasks">Kalenteri →</button></div>
    <section class="card">${taskRows(tasksFor(today), today)}</section>`;
}
function renderMeals() {
  const weekEnd = addDays(weekStart, 6);
  const categories = [...new Set(data.recipes.map(recipe => recipe.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fi"));
  const filtered = data.recipes.filter(recipe => !recipeCategory || recipe.category === recipeCategory);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = dateKey(addDays(weekStart, index));
    const options = data.recipes.map(recipe => `<option value="${esc(recipe.id)}" ${data.meals[date] === recipe.id ? "selected" : ""}>${esc(recipe.name)}</option>`).join("");
    const recipe = data.recipes.find(item => item.id === data.meals[date]);
    return `<div class="item"><div class="row spread"><strong>${esc(weekdayNames[index])} ${esc(niceDate(date, { day: "numeric", month: "numeric" }))}</strong>${recipe ? `<button class="plain" data-view-recipe="${esc(recipe.id)}">Avaa resepti</button>` : ""}</div><select aria-label="${esc(weekdayNames[index])} ruoka" data-meal="${date}"><option value="">Ei valittua ruokaa</option>${options}</select></div>`;
  }).join("");
  return `<div class="heading"><h2>Viikon ruoat</h2><button class="primary" data-add-recipe>+ Resepti</button></div>
    <section class="card"><div class="row spread"><button class="plain" data-week="-1" aria-label="Edellinen viikko">←</button><strong>${esc(niceDate(dateKey(weekStart), { day: "numeric", month: "numeric" }))} – ${esc(niceDate(dateKey(weekEnd), { day: "numeric", month: "numeric", year: "numeric" }))}</strong><button class="plain" data-week="1" aria-label="Seuraava viikko">→</button></div>${days}<button class="primary" data-generate-shopping>Muodosta ostoslista</button><p class="hint">Lista muodostetaan tämän näkyvän viikon aterioista.</p></section>
    <div class="heading"><h2>Omat reseptit</h2></div><section class="card">
    <button class="secondary primary" data-import-recipes>Tuo reseptit tiedostosta</button>
    ${categories.length ? `<label for="category-filter">Näytä kategoria</label><select id="category-filter"><option value="">Kaikki reseptit</option>${categories.map(category => `<option value="${esc(category)}" ${recipeCategory === category ? "selected" : ""}>${esc(category)}</option>`).join("")}</select>` : ""}
    ${filtered.length ? filtered.map(recipe => `<div class="item row"><span class="grow"><strong>${esc(recipe.name)}</strong>${recipe.category ? `<br><span class="muted">${esc(recipe.category)}</span>` : ""}</span><button class="plain" data-view-recipe="${esc(recipe.id)}">Avaa</button><button class="plain" data-edit-recipe="${esc(recipe.id)}">Muokkaa</button></div>`).join("") : "<div class='empty'>Ei reseptejä tässä kategoriassa. Lisää oma resepti tai tuo reseptit tiedostosta.</div>"}</section>`;
}
function renderShopping() {
  const items = data.shopping.map(item => `<div class="item row"><input class="check" type="checkbox" data-check-shopping="${esc(item.id)}" ${item.checked ? "checked" : ""} aria-label="Merkitse ${esc(item.text)} ostetuksi"><span class="grow ${item.checked ? "done" : ""}">${esc(item.text)}</span><button class="plain danger" data-delete-shopping="${esc(item.id)}" aria-label="Poista ${esc(item.text)}">✕</button></div>`).join("");
  return `<div class="heading"><h2>Ostoslista</h2></div><section class="card"><p class="hint">Rastita ostokset kaupassa. Voit lisätä myös muita tuotteita.</p><form id="shopping-form" class="row"><input name="item" aria-label="Lisättävä ostos" placeholder="Esim. kauramaito" required maxlength="200"><button class="primary">Lisää</button></form>${items || "<div class='empty'>Lista on vielä tyhjä. Muodosta se Ruoat-välilehdellä tai lisää ostoksia itse.</div>"}${items ? "<button class='plain danger' data-clear-shopping>Tyhjennä lista</button>" : ""}</section>`;
}
function renderTasks() {
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const firstDay = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const blanks = "<span class='blank'></span>".repeat(firstDay);
  const days = Array.from({ length: count }, (_, index) => {
    const key = dateKey(new Date(year, monthIndex, index + 1));
    return `<button class="${tasksFor(key).length ? "has-tasks" : ""} ${selectedDate === key ? "selected" : ""}" data-select-date="${key}" aria-label="${esc(niceDate(key))}${tasksFor(key).length ? ", tehtäviä" : ""}" ${selectedDate === key ? 'aria-current="date"' : ""}>${index + 1}</button>`;
  }).join("");
  return `<div class="heading"><h2>Tehtävät</h2><button class="primary" data-add-task>+ Tehtävä</button></div>
    <section class="card"><div class="row spread"><button class="plain" data-month="-1" aria-label="Edellinen kuukausi">←</button><strong>${esc(month.toLocaleDateString("fi-FI", { month: "long", year: "numeric" }))}</strong><button class="plain" data-month="1" aria-label="Seuraava kuukausi">→</button></div><div class="calendar">${weekdays.map(day => `<span class="weekday">${day}</span>`).join("")}${blanks}${days}</div><p class="hint">Vihreällä merkityillä päivillä on tehtäviä.</p></section>
    <div class="heading"><h3>${esc(niceDate(selectedDate))}</h3></div><section class="card">${taskRows(tasksFor(selectedDate), selectedDate)}</section>
    <p class="hint">Lisää kuukausittain vaihtuvat tehtävät itse. Viikkotehtävät toistuvat automaattisesti valittuna viikonpäivänä.</p>`;
}
function render() {
  document.querySelectorAll(".tabs button").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tab);
    button.setAttribute("aria-current", button.dataset.tab === tab ? "page" : "false");
  });
  app.innerHTML = ({ today: renderToday, meals: renderMeals, shopping: renderShopping, tasks: renderTasks })[tab]();
}
function recipeDialog(recipe) {
  const editing = Boolean(recipe);
  recipe ||= { name: "", url: "", ingredients: "", notes: "", category: "" };
  const existingLinks = recipe.links?.length ? recipe.links : (recipe.url ? [{ url: recipe.url, label: "" }] : []);
  modal(`<h2>${editing ? "Muokkaa reseptiä" : "Lisää resepti"}</h2><form id="recipe-form">
    <label for="recipe-name">Ruoan nimi</label><input id="recipe-name" name="name" required maxlength="150" value="${esc(recipe.name)}">
    <label for="recipe-category">Kategoria (valinnainen)</label><input id="recipe-category" name="category" maxlength="100" placeholder="Esim. Helpot tai Pasta" value="${esc(recipe.category || "")}">
    <label for="recipe-links">Linkit ohjeisiin (valinnainen)</label><p class="hint">Kirjoita yksi osoite kullekin riville.</p><textarea id="recipe-links" name="links" placeholder="https://...">${esc(existingLinks.map(link => link.url).join("\n"))}</textarea>
    <label for="recipe-ingredients">Ainekset</label><p class="hint">Kirjoita yksi aines omalle rivilleen, esimerkiksi ”2 dl maitoa”.</p><textarea id="recipe-ingredients" name="ingredients">${esc(recipe.ingredients)}</textarea>
    <label for="recipe-notes">Ohje tai omat muistiinpanot (valinnainen)</label><textarea id="recipe-notes" name="notes">${esc(recipe.notes)}</textarea>
    <div class="dialog-actions"><button class="primary">Tallenna</button><button type="button" class="secondary primary" data-close>Peruuta</button>${editing ? "<button type='button' class='plain danger' data-delete-recipe>Poista resepti</button>" : ""}</div></form>`, dialog => {
    dialog.querySelector("#recipe-form").addEventListener("submit", event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = form.get("name").trim();
      const links = form.get("links").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (!name) { alert("Kirjoita reseptin nimi."); return; }
      if (links.some(link => !linkFor(link))) { alert("Jokaisen linkin tulee alkaa https:// tai http://."); return; }
      const entry = { ...recipe, id: recipe.id || id(), name, url: links[0] || "", links: links.map(url => ({ url, label: existingLinks.find(link => link.url === url)?.label || "" })), category: form.get("category").trim(), ingredients: form.get("ingredients").trim(), notes: form.get("notes").trim() };
      if (editing) data.recipes = data.recipes.map(item => item.id === recipe.id ? entry : item);
      else data.recipes.push(entry);
      dialog.close(); saveRender("Resepti tallennettu");
    });
    dialog.querySelector("[data-delete-recipe]")?.addEventListener("click", () => {
      if (!confirm("Poistetaanko resepti myös viikon ruokalistoilta?")) return;
      data.recipes = data.recipes.filter(item => item.id !== recipe.id);
      for (const date of Object.keys(data.meals)) if (data.meals[date] === recipe.id) delete data.meals[date];
      dialog.close(); saveRender("Resepti poistettu");
    });
  });
}
function viewRecipe(recipe) {
  const links = (recipe.links?.length ? recipe.links : [{ url: recipe.url, label: "" }]).filter(link => linkFor(link.url));
  modal(`<h2>${esc(recipe.name)}</h2>${recipe.category ? `<p><span class="tag">${esc(recipe.category)}</span></p>` : ""}${links.length ? `<p>${links.map((link, index) => `<a href="${esc(linkFor(link.url))}" target="_blank" rel="noopener noreferrer">${esc(link.label || (links.length === 1 ? "Avaa alkuperäinen resepti" : `Reseptilinkki ${index + 1}`))} ↗</a>`).join("<br>")}</p><p class="hint">Verkkolinkit tarvitsevat internetyhteyden.</p>` : ""}
    <h3>Ainekset</h3><p style="white-space:pre-wrap">${esc(recipe.ingredients || "Ei tallennettuja aineksia.")}</p>${recipe.notes ? `<h3>Ohje tai muistiinpanot</h3><p style="white-space:pre-wrap">${esc(recipe.notes)}</p>` : ""}
    <div class="dialog-actions"><button class="primary" data-edit>Muokkaa</button><button class="secondary primary" data-close>Sulje</button></div>`, dialog => dialog.querySelector("[data-edit]").addEventListener("click", () => { dialog.close(); recipeDialog(recipe); }));
}
function importRecipesDialog() {
  modal(`<h2>Tuo reseptejä</h2><p>Valitse Oma arkea varten tehty reseptien JSON-tiedosto. Reseptit lisätään nykyisten tietojesi rinnalle; aiempia reseptejä, ostoksia tai tehtäviä ei poisteta.</p>
    <label for="recipes-file">Reseptitiedosto</label><input type="file" id="recipes-file" accept=".json,application/json"><p class="hint">Word-tiedosto pitää ensin muuntaa Oma arjen reseptitiedostoksi. Jo tuotuja reseptejä ei lisätä uudelleen.</p><button class="secondary primary" data-close>Sulje</button>`, dialog => {
    dialog.querySelector("#recipes-file").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error("Tiedosto on liian suuri.");
        const bundle = JSON.parse(await file.text());
        if (!bundle || bundle.type !== "oma-arki-recipes" || bundle.version !== 1 || !Array.isArray(bundle.recipes) ||
            !isValidData({ ...emptyData(), recipes: bundle.recipes }) ||
            bundle.recipes.some(recipe => !recipe.importId || !recipe.name.trim() || [recipe.url, ...(recipe.links || []).map(link => link.url)].some(url => url && !linkFor(url)))) {
          throw new Error("Tiedosto ei ole kelvollinen Oma arki -reseptitiedosto.");
        }
        const known = new Set(data.recipes.map(recipe => recipe.importId).filter(Boolean));
        const additions = [];
        for (const recipe of bundle.recipes) {
          if (!known.has(recipe.importId)) {
            additions.push({ ...recipe, id: id() });
            known.add(recipe.importId);
          }
        }
        if (!additions.length) { alert("Kaikki tämän tiedoston reseptit on jo tuotu."); return; }
        const previous = data.recipes;
        data.recipes = [...data.recipes, ...additions];
        if (!save()) { data.recipes = previous; return; }
        dialog.close(); recipeCategory = ""; render();
        alert(`${additions.length} reseptiä lisätty. Tarkista ainekset ennen ostoslistan muodostamista.`);
      } catch (error) { alert(`Reseptejä ei voitu tuoda: ${error.message}`); }
      finally { event.target.value = ""; }
    });
  });
}
function taskDialog(task) {
  const editing = Boolean(task);
  task ||= { name: "", type: "once", date: selectedDate, weekday: (fromKey(selectedDate).getDay() + 6) % 7 };
  modal(`<h2>${editing ? "Muokkaa tehtävää" : "Lisää tehtävä"}</h2><form id="task-form">
    <label for="task-name">Mitä haluaisit tehdä?</label><input id="task-name" name="name" required maxlength="150" value="${esc(task.name)}" placeholder="Esim. Pyyhi keittiön tasot">
    <label for="task-type">Kuinka usein?</label><select id="task-type" name="type"><option value="once" ${task.type === "once" ? "selected" : ""}>Kerran, valittuna päivänä</option><option value="weekly" ${task.type === "weekly" ? "selected" : ""}>Joka viikko</option></select>
    <div id="date-field"><label for="task-date">Päivämäärä</label><input id="task-date" type="date" name="date" value="${esc(task.date || selectedDate)}"></div>
    <div id="weekday-field"><label for="task-weekday">Viikonpäivä</label><select id="task-weekday" name="weekday">${weekdayNames.map((name, i) => `<option value="${i}" ${task.weekday === i ? "selected" : ""}>${name}</option>`).join("")}</select></div>
    <div class="dialog-actions"><button class="primary">Tallenna</button><button type="button" class="secondary primary" data-close>Peruuta</button>${editing ? "<button type='button' class='plain danger' data-delete-task>Poista tehtävä</button>" : ""}</div></form>`, dialog => {
    const form = dialog.querySelector("#task-form"), type = form.elements.type;
    const toggle = () => { dialog.querySelector("#date-field").hidden = type.value !== "once"; dialog.querySelector("#weekday-field").hidden = type.value !== "weekly"; };
    type.addEventListener("change", toggle); toggle();
    form.addEventListener("submit", event => {
      event.preventDefault();
      const values = new FormData(form), name = values.get("name").trim();
      if (!name) { alert("Kirjoita tehtävän nimi."); return; }
      if (values.get("type") === "once" && !values.get("date")) { alert("Valitse päivämäärä."); return; }
      const entry = values.get("type") === "once"
        ? { id: task.id || id(), name, type: "once", date: values.get("date") }
        : { id: task.id || id(), name, type: "weekly", weekday: Number(values.get("weekday")) };
      if (editing) data.tasks = data.tasks.map(item => item.id === task.id ? entry : item);
      else data.tasks.push(entry);
      if (entry.type === "once") { selectedDate = entry.date; month = new Date(fromKey(entry.date).getFullYear(), fromKey(entry.date).getMonth(), 1); }
      dialog.close(); saveRender("Tehtävä tallennettu");
    });
    dialog.querySelector("[data-delete-task]")?.addEventListener("click", () => {
      if (!confirm("Poistetaanko tehtävä? Viikkotehtävä poistuu myös tulevilta viikoilta.")) return;
      data.tasks = data.tasks.filter(item => item.id !== task.id);
      for (const key of Object.keys(data.completed)) if (key.startsWith(`${task.id}|`)) delete data.completed[key];
      dialog.close(); saveRender("Tehtävä poistettu");
    });
  });
}
function settingsDialog() {
  modal(`<h2>Asetukset ja varmuuskopio</h2><p>Tiedot tallennetaan tähän laitteeseen, eivät automaattisesti pilveen. Ota varmuuskopio säännöllisesti, jotta voit palauttaa tiedot esimerkiksi puhelimen vaihtuessa.</p>
    <div class="stack"><button class="primary" data-export>Vie varmuuskopio</button><div><label for="backup-file">Palauta varmuuskopio</label><input type="file" id="backup-file" accept=".json,application/json"><p class="hint">Palautus korvaa kaikki tässä laitteessa olevat sovelluksen tiedot.</p></div><button class="secondary primary" data-close>Sulje</button></div>`, dialog => {
    dialog.querySelector("[data-export]").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = `oma-arki-varmuuskopio-${dateKey(new Date())}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      showToast("Varmuuskopio luotu. Tallenna se Tiedostot-sovellukseen.");
    });
    dialog.querySelector("#backup-file").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error("Tiedosto on liian suuri.");
        const restored = JSON.parse(await file.text());
        if (!isValidData(restored)) throw new Error("Tiedosto ei ole kelvollinen Oma arki -varmuuskopio.");
        if (!confirm("Palautus korvaa tämän laitteen nykyiset reseptit, tehtävät ja ostoslistan. Jatketaanko?")) return;
        const previous = data;
        data = restored;
        if (!save()) { data = previous; return; }
        dialog.close(); render(); showToast("Varmuuskopio palautettu");
      } catch (error) { alert(`Varmuuskopiota ei voitu palauttaa: ${error.message}`); }
      finally { event.target.value = ""; }
    });
  });
}

document.querySelector(".tabs").addEventListener("click", event => {
  const button = event.target.closest("[data-tab]");
  if (button) { tab = button.dataset.tab; render(); window.scrollTo(0, 0); }
});
document.querySelector("#settings-button").addEventListener("click", settingsDialog);
app.addEventListener("change", event => {
  const element = event.target;
  if (element.id === "category-filter") {
    recipeCategory = element.value; render();
  } else if (element.matches("[data-meal]")) {
    if (element.value) data.meals[element.dataset.meal] = element.value;
    else delete data.meals[element.dataset.meal];
    saveRender();
  } else if (element.matches("[data-check-shopping]")) {
    const item = data.shopping.find(i => i.id === element.dataset.checkShopping);
    if (item) { item.checked = element.checked; saveRender(); }
  } else if (element.matches("[data-check-task]")) {
    const task = data.tasks.find(t => t.id === element.dataset.checkTask);
    if (task) { data.completed[completedKey(task, element.dataset.date)] = element.checked; saveRender(); }
  }
});
app.addEventListener("submit", event => {
  if (event.target.id !== "shopping-form") return;
  event.preventDefault();
  const text = event.target.elements.item.value.trim();
  if (!text) { alert("Kirjoita lisättävä ostos."); return; }
  data.shopping.push({ id: id(), text, checked: false }); saveRender("Lisätty ostoslistaan");
});
app.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const a = button.dataset;
  if (a.go) { tab = a.go; render(); }
  else if ("addRecipe" in a) recipeDialog();
  else if ("importRecipes" in a) importRecipesDialog();
  else if (a.editRecipe) { const recipe = data.recipes.find(r => r.id === a.editRecipe); if (recipe) recipeDialog(recipe); }
  else if (a.viewRecipe) { const recipe = data.recipes.find(r => r.id === a.viewRecipe); if (recipe) viewRecipe(recipe); }
  else if (a.week) { weekStart = addDays(weekStart, Number(a.week) * 7); render(); }
  else if ("generateShopping" in a) {
    const recipes = Array.from({ length: 7 }, (_, index) => data.recipes.find(r => r.id === data.meals[dateKey(addDays(weekStart, index))])).filter(Boolean);
    if (!recipes.length) { alert("Valitse ensin vähintään yksi ruoka tälle viikolle."); return; }
    const missing = recipes.filter(recipe => !recipe.ingredients.trim());
    if (missing.length) { alert(`Lisää ensin ainekset näihin resepteihin, jotta ostoslistasta ei puutu tuotteita:\n\n${[...new Set(missing.map(recipe => recipe.name))].join("\n")}`); return; }
    const lines = recipes.flatMap(r => r.ingredients.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    if (!lines.length) { alert("Valituissa resepteissä ei ole aineksia. Lisää ne ensin resepteihin."); return; }
    if (data.shopping.length && !confirm("Korvataanko nykyinen ostoslista tämän viikon aineksilla?")) return;
    data.shopping = lines.map(text => ({ id: id(), text, checked: false }));
    tab = "shopping"; saveRender("Ostoslista muodostettu. Tarkista määrät ja mahdolliset tuplatuotteet.");
  } else if (a.deleteShopping) { data.shopping = data.shopping.filter(item => item.id !== a.deleteShopping); saveRender(); }
  else if ("clearShopping" in a) { if (confirm("Tyhjennetäänkö ostoslista?")) { data.shopping = []; saveRender(); } }
  else if ("addTask" in a) taskDialog();
  else if (a.editTask) { const task = data.tasks.find(t => t.id === a.editTask); if (task) taskDialog(task); }
  else if (a.selectDate) { selectedDate = a.selectDate; render(); }
  else if (a.month) {
    month = new Date(month.getFullYear(), month.getMonth() + Number(a.month), 1);
    selectedDate = dateKey(month);
    render();
  }
});
window.addEventListener("storage", event => {
  if (event.key !== KEY) return;
  try { data = load(); render(); showToast("Tiedot päivitetty toisesta näkymästä."); }
  catch { alert("Toisen näkymän tietoja ei voitu lukea."); }
});
render();
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js").catch(() => showToast("Offline-käyttöä ei voitu ottaa käyttöön. Tarkista yhteys ja avaa sovellus uudelleen."));
}
