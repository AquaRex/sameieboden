# Bedehusvegen Sameie – Felles utstyr

En enkel, modulær, statisk nettside som viser oversikt over felles verktøy og utstyr i sameiets bod. Søkbar med fritekst og tag-filter, og med innebygde redigeringsverktøy når siden kjøres lokalt.

## Kjøre lokalt

Siden bruker ES-moduler, så den må serveres over HTTP (ikke åpnes som `file://` i Chrome).

For å redigere innhold som havner i git, bruk den medfølgende dev-serveren:

```sh
python3 dev_server.py            # http://localhost:8000
python3 dev_server.py 8080       # annen port
```

Den serverer sidene **og** tar imot bilder + endringer fra editoren og skriver dem til `images/` og `data/items.json`. Da kan du committe og pushe til GitHub Pages.

Hvis du bare vil se på siden uten å redigere, holder det med en hvilken som helst statisk server (`python3 -m http.server`, `npx serve .` osv.).

Åpne deretter `http://localhost:8000`.

## Edit-modus

Når siden lastes fra `localhost`, `127.0.0.1` eller `file://`, vises en redigeringslinje øverst og hver oppføring får knapper for **Rediger** (✎) og **Slett** (🗑). På den publiserte siden er disse skjult.

Du kan også tvinge edit-modus i utvikling med `?edit=1` i URL-en.

I redigeringsmodus kan du:

- **+ Legg til utstyr** – åpner modal for nytt element
- **Rediger** – åpner modal med eksisterende verdier
- **Slett** – fjerner et element (med bekreftelse)
- **Eksporter JSON** – laster ned `utstyr.json` med all data
- **Importer JSON** – erstatter listen fra en JSON-fil
- **Tilbakestill** – tilbakestiller til standardlisten i `js/defaultData.js`

Modalen lar deg skrive navn, beskrivelse, dra/velge bilde, og legge til tags – enten ved å skrive nye eller klikke på eksisterende.

## Datalagring

- **Kilde for den publiserte siden**: `data/items.json`. Dette er fila som besøkende laster.
- **Bilder**: lagres som vanlige filer i `images/` og refereres med relativ sti (f.eks. `images/rive.jpg`).
- **Når du redigerer lokalt** med `dev_server.py`:
  - Bilder du drar inn lastes opp til serveren og skrives til `images/<slug>.<ext>`.
  - Hver endring (lagre, slette, redigere) PUT-es til serveren som overskriver `data/items.json`.
  - Commit `images/` + `data/items.json` og push for å oppdatere den publiserte siden.
- Hvis du redigerer uten dev-serveren (f.eks. ren `http.server`) faller den tilbake til å lagre i `localStorage` – endringer blir ikke skrevet til disk.
- `js/defaultData.js` brukes kun som fallback hvis `data/items.json` mangler eller er tom.

## Caching og publisering

Siden er bygget for å hindre at besøkende ser utdatert innhold:

- HTML-en sender `Cache-Control: no-cache` (via meta-tag), så nettleseren revaliderer på hvert besøk.
- `data/items.json` hentes alltid med `cache: "no-store"` – nye eller endrede oppføringer dukker opp umiddelbart.
- Bilder som **byttes ut** får automatisk `?v=<timestamp>` i stien så nettleseren henter den nye fila i stedet for den cachede.
- JS- og CSS-filer har en `?v=N`-versjon i `index.html` og i alle imports.

**Når du endrer kode (JS/CSS):** kjør `python3 bump_version.py` før du pusher. Det bumper versjonsstrengen i alle imports og asset-referanser, så besøkende garantert får den nye koden selv om de hadde den gamle cachet.

**Når du bare endrer innhold (oppføringer/bilder):** ingen bump nødvendig. items.json er allerede no-store, og bilder cache-bustes automatisk.

## Filstruktur

```
index.html
styles.css
js/
  main.js              # bootstrap: kobler sammen komponenter og store
  env.js               # avgjør om edit-modus skal være på
  store.js             # state + localStorage + pub/sub
  search.js            # ren filtreringslogikk (ingen DOM)
  defaultData.js       # standard utstyrsliste
  dom.js               # små DOM-hjelpere (el, clear, uid)
  components/
    searchBar.js
    tagFilters.js
    grid.js            # liste over kort + tom-tilstand + telling
    card.js            # ett kort, med valgfrie edit-knapper
    toolbar.js         # add / import / export / reset (kun lokalt)
    editor.js          # modal for opprett/rediger
images/                # (valgfritt) statiske bilder hvis du foretrekker filer
```

## Designprinsipper

- **Én kilde til sannhet**: All data går gjennom `store.js`. Komponenter abonnerer.
- **Ren logikk**: `search.js` har ingen DOM-avhengigheter.
- **Komposisjon**: Hver komponent eksponerer kun det `main.js` trenger.
- **Ingen byggekjede**: Rene ES-moduler, ingen `node_modules`, ingen bundler.
- **Progressive disclosure**: Edit-UI vises kun lokalt; offentlig versjon er strippet.
