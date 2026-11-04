# Storefront fonts

Self-hosted upright display fonts from Google Fonts:

- Noto Sans Armenian: condensed width 75, weight 900 (Armenian glyphs).
- Oswald: weight 700 (Latin and Cyrillic glyphs).

Source CSS: https://fonts.googleapis.com/css2?family=Noto+Sans+Armenian:wdth,wght@75,900&family=Oswald:wght@700&display=swap

Both fonts are distributed under the SIL Open Font License. The corresponding
license files are included in this directory.

## Vrdznagir Armenian

`Vrdznagir.otf` is the unmodified regular-weight font supplied by the project
owner in `fonter.am_vrdznagir.zip` on 2026-11-04. Its embedded copyright reads:
“Typeface © (Levon Chkolyan). 2020. All Rights Reserved”. The supplied archive
contains no separate license file; this font is not covered by the SIL licenses
for Noto Sans Armenian and Oswald above.

The storefront self-hosts this font with `font-display: swap` and an Armenian-only
Unicode range. Armenian text, including slogan headings and form controls, uses
Vrdznagir; Latin and Cyrillic keep the existing fonts. Only the supplied regular
weight is declared; the asset is not a variable font.
