# DroneCores: Vorprüfung von Bildrechten und Quellen, 19. Oktober 2026

**Zweck:** Alle technischen/rechtlichen Vorbereitungsschritte vor der nächsten 37er-Recherchecharge (Schritt 8). **Keine Production-Änderung, keine Produktfreigabe und keine Verwendung fremder Produktbilder.**

## 1. Nachweise erneut geprüft

Am 19.10.2026 um ca. 19:11 UTC hat der isolierte GitHub-Runner **alle vier offiziellen Herstellerseiten** per HTTPS geladen; bei allen vier wurden die erwarteten Modell-/Kern-Spezifikationsmarker gefunden. **Acht Unit-Tests bestanden.**

- **CNHL 1300mAh 3S 130C XT60 Einzelpackung**, Lagernummer `1301303BK`, 1300 mAh, 3 Zellen (nicht 6S): https://chinahobbyline.com/de/products/cnhl-black-series-1300mah-11-1v-3s-130c-lipo-battery-with-xt60-plug
- **HQProp ETHIX P2 Pickle, 4er-Pack**, 2 CW + 2 CCW, 5,1 Zoll, 2,9 Steigung: https://www.hqprop.com/ethix-p2-pickle-prop-2cw2ccw-poly-carbonate-p0459.html. Die Kennung `EthixP2-PK-PC` und die davon verschiedene GTIN `9313448340470` stimmen mit RCTech überein: https://www.rctech.de/?a=7000&lang=eng
- **TBS Crossfire Nano RX (SE)** mit Immortal-T V2, CRSF, 868–915 MHz, Versorgung 3,3–8,4 V: https://www.team-blacksheep.com/products/prod:crossfire_nano_se
- **TBS Lucid 6S 4in1 ESC**, 4x60A, AM32, 3–6S: https://www.team-blacksheep.com/products/prod:lucid_4in1. Das im früheren QA-Handbuchreview festgestellte **8-polige JST-SH 1.0 mm** FC-Verbindungskabel bleibt als eigenständiger Handbuchnachweis mit erneut notwendiger Reviewer-Abnahme gekennzeichnet: https://www.team-blacksheep.com/media/files/tbs-lucid-manual.pdf

Das JSON `qa/prestep8-manufacturer-source-verification.json` erfasst **13 technische Pflichtfelder in korrekten Datenbankeinheiten** und ihre Herstellerquelle. Die erneute maschinelle Quellenprüfung ist **keine** manuelle formale DB-Abnahme: `reviewer_approved=false` bleibt für sämtliche 13 Felder bestehen, ebenso `approve_identity=false` für alle vier Produktidentitäten.

## 2. Bildrechte: Stand und zulässiger Vorschlag

Kein Produktfoto von Hersteller, Händler oder Suchmaschine wird in DroneCores kopiert, über eine fremde CDN-Adresse eingebunden oder als lizenziert markiert.

- CNHL schützt Website-Inhalte einschließlich Bilder laut veröffentlichten Bedingungen: https://chinahobbyline.com/pages/terms-and-conditions
- Rotorama schützt Produktbilder und untersagt die sonstige Kopie in den Shopbedingungen: https://www.rotorama.de/obchodni-podminky
- HQProp gibt All-Rights-Reserved-Hinweise auf seinen Seiten; eine konkrete Lizenz wurde nicht festgestellt.
- Für TBS oder RCTech konnte keine ausdrückliche Rechteübertragung an DroneCores belegt werden.

**Zulässige technische Alternative:** Das bestehende `ProductThumbnail` in `src/components/BuildInterface.tsx` nutzt bei fehlendem `image` automatisch `ImageOff` aus `lucide-react`. Lucide ist kommerziell unter ISC verwendbar; die Lizenz verlangt Erhalt der Lizenz- und Copyright-Hinweise: https://lucide.dev/license. Falls Bildquelle und Lizenz fehlen, `product.image`/Datenbank-`image_url` **NULL** lassen. Der Schritt-7-Release-Gate kann diese Icon-Variante erst nach menschlicher Policy-Abnahme gestatten. Die Icon-Nutzung braucht keine Erlaubnis des FPV-Herstellers, weil kein Herstellerfoto verwendet wird.

**Noch offen:** Eigentümer akzeptiert den neutralen Icon-Modus für neue Produkte. Solange nicht entschieden, `media_policy_approved=false`. Herstellerbilder sind auch danach nicht freigegeben.

## 3. EU-Preis-/Bestandsnachweis bleibt getrennt

Letzter voriger automatischer Händlerlauf (19.10.2026, ca. 18:57 UTC): CNHL 14,39 EUR, Lagerbestand unklar; HQProp P2 2,99 EUR/in stock; TBS Nano RX SE 29,90 EUR/in stock; TBS Lucid 6S 59,90 EUR/in stock. **Alle Angebote sind nur Momentaufnahmen und dürfen nicht als vom Reviewer verifizierte Datenbankangebote gelten.** Nach 24 Stunden (oder bei Preis-/Stockänderung) sind sie für die Erstfreigabe wieder neu abzurufen.

Die automatische Seite ist überprüft; formale Verifizierung erfordert nun für jeden einzelnen Kandidaten:

1. Original-Herstellerseite und Variante/Packung **unabhängig** prüfen; für das ESC-Kabel das Handbuchdiagramm kontrollieren.
2. Die zugehörigen 13 technischen Pflichtwerte in den JSON-Nachweisen abnehmen; Hersteller-SKU und Händler-GTIN auseinanderhalten. `voltage`, `minVoltage` und `maxVoltage` sind in der DB **Zellenzahlen**, keine Nominalspannung in Volt.
3. Pro Produkt ein **aktuelles** exakt zugeordnetes EU-EUR-Händlerangebot samt eindeutigem `in_stock`, Preis und Abrufzeitpunkt nachweisen. CNHL bleibt bei ungeklärtem Bestand **HOLD**.
4. Die neutrale Bilddarstellung als Policy genehmigen **oder** eine echte Lizenz für das konkret passende Herstellerfoto nachweisen.
5. Separate, ausdrückliche Eigentümerfreigabe erteilen, bevor die produktive SQL-Promotion verwendet wird. Die neue RLS-/Owner-/Medien-/Händler-Sperre aus PR #12 ist ein **noch nicht** produktiv angewendeter Entwurf.

## 4. Nächste Arbeitsphase

Nach diesen Abnahmen die bestehende **37er-Recherchewarteschlange** aus dem 171er-Herstellerpilot bearbeiten, Herstellerdaten ergänzen und mit frischen Händlerangeboten verknüpfen. Der Import darf weiterhin nur review-pending-Kandidaten erzeugen. Nicht in Production veröffentlichen, solange diese Regeln nicht nach separater Nutzerfreigabe integriert und erfüllt sind.

## 5. Tests und Dateien

- `qa/prestep8-manufacturer-source-verification.json`: vier offizielle Hersteller-URLs, die 13 Feldbelege, Variantenfallen und Reviewer-Sperren.
- `qa/prestep8-media-rights-register.json`: 4× gesperrte Fremdbilder, dokumentierte Lizenzlage und prüfbare Icon-Alternative.
- `docs/prestep8-media-rights-policy.md`: Lizenz- und Bildnutzungsregeln.
- `tests/integration/prestep8-official-page-recheck.ts`: ausschließlich lesender Hersteller-HTML-Abruf, keine Bilder.
- `tests/prestep8-media-and-manufacturer-evidence.test.ts`: negative Veröffentlichungstests für Rechte/Nachweisstand.
- [Isolierte GitHub Actions 39308841451](https://github.com/3pbrodi/drone-core-builder/actions/runs/39308841451): **alle 4 Herstellerseiten erreichbar, alle getesteten Identitäts-/Spezifikationsmarker gefunden, 8/8 Tests bestanden, 0 Bilddownloads und 0 Freigaben**.

**Freigabeentscheidung:** QA-Vorbereitung **bestanden**. Menschliche Bildpolicy-/Produkt-/Angebotsfreigaben **offen**; öffentliches Release **gesperrt**.
