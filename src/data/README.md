# Show city catalog

`show-cities.json` is a local derivative of [GeoNames](https://www.geonames.org/),
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Downloaded September 19, 2026. 31,644 populated places.

Sources: https://download.geonames.org/export/dump/cities15000.zip,
admin1CodesASCII.txt and countryInfo.txt from the same directory.
The source includes cities over 15,000 inhabitants and administrative capitals;
smaller/unlisted municipalities can use the explicit manual-entry option.
Only current populated-place codes PPL, PPLA through PPLA5, PPLC, PPLG are kept.
Neighborhood sections (PPLX), historical/abandoned places and all non-city feature
classes are excluded. GeoNames classifications are used as supplied; this is not
a legal municipal-boundary registry.

Transformation: joined country and region names, removed unused columns, sorted
by population. Tuple columns: GeoNames ID, city, region, US state abbreviation,
country, ISO country code, latitude, longitude, population, ASCII city name.
The UI renders US city/state and international city/region/country labels.
NYC and Vegas aliases resolve to the corresponding GeoNames records.

Refresh intentionally with `node scripts/update-show-cities.mjs` and review the
diff. No runtime provider, API key, network download, or paid service is needed.
The server searches this dataset; it is not bundled into the browser.
