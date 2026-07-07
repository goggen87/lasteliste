# Lasteliste

En enkel mobilvennlig lasteapp som kan installeres på hjem-skjermen som PWA.

## Publisering

Last opp hele mappen til en statisk webhost som støtter HTTPS, for eksempel Netlify, GitHub Pages eller lignende.

Viktig: `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `service-worker.js`, `icon.svg` og hele `assets/`-mappen må være med.

## Bruk på mobil

1. Åpne nettadressen på mobilen.
2. Velg del/meny i nettleseren.
3. Trykk `Legg til på Hjem-skjerm`.
4. Åpne appen fra ikonet.

Etter første åpning kan appen brukes uten nett. Logger og tidligere biler lagres lokalt på hver mobil.

## Dele med kollegaer

Send samme nettadresse til kollegaer. Hver telefon får egen lokal lagring.
