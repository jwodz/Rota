// ================================================================
//  USTAWIENIA APLIKACJI „ROTA”
//  Dopóki SUPABASE_URL jest pusty, aplikacja działa w TRYBIE DEMO
//  (przykładowe dane, zapisywane tylko na tym urządzeniu).
// ================================================================
window.HARC_CONFIG = {
  NAZWA_DRUZYNY: "III Siedlecka Drużyna Harcerzy „Rota”",

  // Supabase → Project Settings → API
  SUPABASE_URL: "https://tkyjwlzyyvbrqkgixheh.supabase.co",        // np. "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_M-7vqeFtsE4Ne8FRIEBhIg_hq5J1756",   // klucz "anon public" / "publishable" (bezpieczny do publikacji)

  // Login "jan.wodzynski" zamienia się w "jan.wodzynski@rota.local".
  // Musi się zgadzać z adresami w pliku konta.sql.
  LOGIN_DOMAIN: "rota.local",

  ZASTEPY: ["Wieprz", "Niemen", "Wisła", "Bug"],

  // Stopnie drużyny po kolei: Chusta, Młodzik, Wywiadowca, Ćwik (lista jest w app.js)

  // Puste karty do pobrania. Wrzuć pliki do folderu "karty"
  // i popraw nazwy oraz ścieżki poniżej (PDF, DOCX, JPG – dowolny format).
  KARTY_SPRAWNOSCI: [
    { nazwa: "Karta podstawowa",                       plik: "karty/sprawnosc-podstawowa.pdf" },
    { nazwa: "Skrzydła św. Michała Archanioła",        plik: "karty/sprawnosc-skrzydla.pdf" },
    { nazwa: "Miecz św. Michała Archanioła",           plik: "karty/sprawnosc-miecz.pdf" },
    { nazwa: "Tarcza św. Michała Archanioła",          plik: "karty/sprawnosc-tarcza.pdf" }
  ],
  KARTY_PROB: [
    { nazwa: "Próba na chustę",       plik: "karty/proba-chusta.pdf" },
    { nazwa: "Próba na młodzika",     plik: "karty/proba-mlodzik.pdf" },
    { nazwa: "Próba na wywiadowcę",   plik: "karty/proba-wywiadowca.pdf" },
    { nazwa: "Próba na ćwika",        plik: "karty/proba-cwik.pdf" }
  ]
};
