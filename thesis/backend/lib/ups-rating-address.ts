/**
 * UPS Rating "Shop" requests reject addresses where CountryCode does not match
 * city / state / postal (e.g. IN + California + US ZIP). Build minimal valid
 * sample addresses per destination for rating-only (not label purchase).
 */

export type UpsRatingAddress = {
  AddressLine: string[];
  City: string;
  StateProvinceCode?: string;
  PostalCode?: string;
  CountryCode: string;
};

const TEMPLATES: Record<
  string,
  { lines: string[]; city: string; state?: string; postal?: string }
> = {
  US: { lines: ['100 Commerce Dr'], city: 'Los Angeles', state: 'CA', postal: '90001' },
  CA: { lines: ['200 Bay St'], city: 'Toronto', state: 'ON', postal: 'M5H 2N2' },
  MX: { lines: ['Av Reforma 1'], city: 'Mexico City', postal: '06000' },
  GB: { lines: ['10 Fleet St'], city: 'London', postal: 'EC4Y 8AA' },
  FR: { lines: ['1 Rue du Temple'], city: 'Paris', postal: '75001' },
  DE: { lines: ['1 Hauptstrasse'], city: 'Berlin', postal: '10115' },
  IT: { lines: ['Via Roma 1'], city: 'Rome', postal: '00118' },
  ES: { lines: ['Calle Gran Via 1'], city: 'Madrid', postal: '28013' },
  NL: { lines: ['Damrak 1'], city: 'Amsterdam', postal: '1012 LG' },
  BE: { lines: ['Rue Neuve 1'], city: 'Brussels', postal: '1000' },
  AT: { lines: ['Stephansplatz 1'], city: 'Vienna', postal: '1010' },
  CH: { lines: ['Bahnhofstrasse 1'], city: 'Zurich', postal: '8001' },
  IE: { lines: ['1 OConnell St'], city: 'Dublin', postal: 'D01 F5P8' },
  PT: { lines: ['Rua Augusta 1'], city: 'Lisbon', postal: '1100-053' },
  PL: { lines: ['ul Marszalkowska 1'], city: 'Warsaw', postal: '00-001' },
  SE: { lines: ['Drottninggatan 1'], city: 'Stockholm', postal: '111 51' },
  NO: { lines: ['Karl Johans gate 1'], city: 'Oslo', postal: '0154' },
  DK: { lines: ['Stroget 1'], city: 'Copenhagen', postal: '1550' },
  FI: { lines: ['Mannerheimintie 1'], city: 'Helsinki', postal: '00100' },
  VN: { lines: ['123 Nguyen Hue'], city: 'Ho Chi Minh City', postal: '700000' },
  IN: { lines: ['BKC Business District'], city: 'Mumbai', postal: '400051' },
  ID: { lines: ['Jl Sudirman 1'], city: 'Jakarta', postal: '10220' },
  SG: { lines: ['1 Raffles Place'], city: 'Singapore', postal: '048616' },
  MY: { lines: ['1 Jalan Ampang'], city: 'Kuala Lumpur', postal: '50450' },
  TH: { lines: ['1 Sukhumvit Rd'], city: 'Bangkok', postal: '10110' },
  PH: { lines: ['Ayala Ave 1'], city: 'Makati', postal: '1200' },
  HK: { lines: ['1 Queen Rd Central'], city: 'Hong Kong', postal: '999077' },
  TW: { lines: ['1 Zhongshan Rd'], city: 'Taipei', postal: '100' },
  CN: { lines: ['Nanjing Rd E 1'], city: 'Shanghai', postal: '200000' },
  JP: { lines: ['1 Marunouchi'], city: 'Tokyo', postal: '100-0005' },
  KR: { lines: ['1 Gangnam'], city: 'Seoul', postal: '06236' },
  AU: { lines: ['100 George St'], city: 'Sydney', state: 'NSW', postal: '2000' },
  NZ: { lines: ['Queen St 1'], city: 'Auckland', postal: '1010' },
  BR: { lines: ['Av Paulista 1000'], city: 'Sao Paulo', postal: '01310-100' },
  AR: { lines: ['Av Corrientes 1'], city: 'Buenos Aires', postal: 'C1043' },
  CL: { lines: ['Alameda 1'], city: 'Santiago', postal: '8320000' },
  CO: { lines: ['Carrera 7 1'], city: 'Bogota', postal: '111711' },
  AE: { lines: ['Sheikh Zayed Rd 1'], city: 'Dubai', postal: '00000' },
  SA: { lines: ['King Fahd Rd'], city: 'Riyadh', postal: '11564' },
  TR: { lines: ['Istiklal Cad 1'], city: 'Istanbul', postal: '34430' },
  IL: { lines: ['Rothschild 1'], city: 'Tel Aviv', postal: '6688103' },
  ZA: { lines: ['Long St 1'], city: 'Cape Town', postal: '8001' },
  EG: { lines: ['Tahrir Sq'], city: 'Cairo', postal: '11511' },
};

export function buildUpsRatingAddress(countryCode: string): UpsRatingAddress {
  const code = (countryCode || 'US').toUpperCase().trim().slice(0, 2);
  const t = TEMPLATES[code] ?? {
    lines: ['1 International Way'],
    city: 'Metro',
    postal: '00000',
  };
  const addr: UpsRatingAddress = {
    AddressLine: t.lines,
    City: t.city,
    CountryCode: code,
  };
  if (t.state) addr.StateProvinceCode = t.state;
  if (t.postal) addr.PostalCode = t.postal;
  return addr;
}
