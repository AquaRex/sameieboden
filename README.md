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
