# Bedehusvegen Sameie – Felles utstyr

En enkel, modulær, statisk nettside som viser oversikt over felles verktøy og utstyr i sameiets bod. Søkbar med fritekst og tag-filter, og med innebygde redigeringsverktøy når siden kjøres lokalt.

## Kjøre lokalt

Siden bruker ES-moduler, så den må serveres over HTTP (ikke åpnes som `file://` i Chrome).

```sh
# fra mappen til prosjektet
python3 -m http.server 8000
# eller:  npx serve .
```

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

- Endringer lagres i nettleserens `localStorage` under nøkkelen `bvs.equipment.v1`.
- Bilder komprimeres til JPEG (~1000 px) og lagres som data-URL.
- Eksporter til JSON for å versjonere endringene eller flytte dem til andre maskiner.

For å gjøre dataen permanent for alle besøkende: Eksporter JSON, og bytt ut innholdet i `js/defaultData.js` med listen fra fila.

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
