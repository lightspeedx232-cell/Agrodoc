// Lightweight internationalization (i18n) for AgroDoc.
//
// Supports English ("en") and Malayalam ("ml") initially, with an architecture
// that makes adding Hindi ("hi") and other Indian languages straightforward:
// add a new entry to the `translations` map and a new button in the language
// switcher. New keys fall back to English when missing.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "ml" | "hi";

const translations: Record<Lang, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.dashboard": "Dashboard",
    "nav.cropDoctor": "Crop Doctor",
    "nav.scanner": "Leaf Scanner",
    "nav.weather": "Weather",
    "nav.farms": "My Farms",
    "nav.schemes": "Schemes",
    "nav.stores": "Govt. Stores",
    "nav.mandi": "Mandi Prices",
    "nav.assistant": "AI Assistant",
    "nav.login": "Sign in",
    "nav.register": "Register",
    "nav.logout": "Sign out",
    "nav.calendar": "Crop Calendar",
    "nav.expenses": "Expenses",
    "nav.marketplace": "Trade",
    "nav.more": "More",
    "nav.resources": "Resources",
    "nav.settings": "Settings",
    "nav.scamReport": "Report Scam",
    "landing.tagline": "Your AI Farming Assistant",
    "landing.cta": "Get started — it's free",
    "landing.scanTitle": "Point your camera at a leaf",
    "landing.scanDesc": "AgroDoc uses your webcam to capture a leaf photo and sends it to the AI Crop Doctor for diagnosis.",
    "common.email": "Email",
    "common.password": "Password",
    "common.fullName": "Full name",
    "common.phone": "Phone (optional)",
    "common.state": "State",
    "common.language": "Language",
    "login.title": "Sign in to AgroDoc",
    "login.submit": "Sign in",
    "login.noAccount": "Don't have an account?",
    "register.title": "Create your AgroDoc account",
    "register.submit": "Create account",
    "register.haveAccount": "Already have an account?",
  },
  ml: {
    "nav.home": "ഹോം",
    "nav.dashboard": "ഡാഷ്ബോർഡ്",
    "nav.cropDoctor": "ക്രോപ്പ് ഡോക്ടർ",
    "nav.scanner": "ലീഫ് സ്കാനർ",
    "nav.weather": "കാലാവസ്ഥ",
    "nav.farms": "എന്റെ ഫാമുകൾ",
    "nav.schemes": "പദ്ധതികൾ",
    "nav.stores": "ഗവ. സ്റ്റോറുകൾ",
    "nav.mandi": "മണ്ടി വില",
    "nav.assistant": "AI സഹായി",
    "nav.login": "സൈൻ ഇൻ",
    "nav.register": "രജിസ്റ്റർ",
    "nav.logout": "സൈൻ ഔട്ട്",
    "nav.calendar": "ക്രോപ്പ് കലണ്ടർ",
    "nav.expenses": "ചെലവുകൾ",
    "nav.marketplace": "ട്രേഡ്",
    "nav.more": "കൂടുതൽ",
    "nav.resources": "വിഭവങ്ങൾ",
    "nav.settings": "ക്രമീകരണങ്ങൾ",
    "nav.scamReport": "തട്ടിപ്പ് റിപ്പോർട്ട്",
    "landing.tagline": "നിങ്ങളുടെ AI കൃഷി സഹായി",
    "landing.cta": "ആരംഭിക്കുക — സൗജന്യം",
    "landing.scanTitle": "ക്യാമറ ഇലയിലേക്ക് തിരിക്കുക",
    "landing.scanDesc": "നിങ്ങളുടെ വെബ്ക്യാം ഉപയോഗിച്ച് ഇലയുടെ ഫോട്ടോ എടുത്ത് AI ക്രോപ്പ് ഡോക്ടർക്ക് അയയ്ക്കുന്നു.",
    "common.email": "ഇമെയിൽ",
    "common.password": "പാസ്‌വേഡ്",
    "common.fullName": "പൂർണ്ണ പേര്",
    "common.phone": "ഫോൺ (ഓപ്ഷണൽ)",
    "common.state": "സംസ്ഥാനം",
    "common.language": "ഭാഷ",
    "login.title": "AgroDoc-ൽ സൈൻ ഇൻ ചെയ്യുക",
    "login.submit": "സൈൻ ഇൻ",
    "login.noAccount": "അക്കൗണ്ട് ഇല്ലേ?",
    "register.title": "AgroDoc അക്കൗണ്ട് സൃഷ്ടിക്കുക",
    "register.submit": "അക്കൗണ്ട് സൃഷ്ടിക്കുക",
    "register.haveAccount": "ഇതിനകം അക്കൗണ്ട് ഉണ്ടോ?",
  },
  hi: {
    "nav.home": "होम",
    "nav.dashboard": "डैशबोर्ड",
    "nav.cropDoctor": "क्रॉप डॉक्टर",
    "nav.scanner": "लीफ स्कैनर",
    "nav.weather": "मौसम",
    "nav.farms": "मेरे खेत",
    "nav.schemes": "योजनाएँ",
    "nav.stores": "सरकारी स्टोर",
    "nav.mandi": "मंडी भाव",
    "nav.assistant": "AI सहायक",
    "nav.login": "साइन इन",
    "nav.register": "रजिस्टर",
    "nav.logout": "साइन आउट",
    "nav.calendar": "फसल कैलेंडर",
    "nav.expenses": "खर्च",
    "nav.marketplace": "व्यापार",
    "nav.more": "अधिक",
    "nav.resources": "संसाधन",
    "nav.settings": "सेटिंग्स",
    "nav.scamReport": "धोखाधड़ी रिपोर्ट",
    "landing.tagline": "आपका AI खेती सहायक",
    "landing.cta": "शुरू करें — मुफ़्त",
    "landing.scanTitle": "अपने कैमरे को पत्ती की ओर घुमाएँ",
    "landing.scanDesc": "AgroDoc आपके वेबकैम से पत्ती की फ़ोटो लेकर AI क्रॉप डॉक्टर को भेजता है।",
    "common.email": "ईमेल",
    "common.password": "पासवर्ड",
    "common.fullName": "पूरा नाम",
    "common.phone": "फ़ोन (वैकल्पिक)",
    "common.state": "राज्य",
    "common.language": "भाषा",
    "login.title": "AgroDoc में साइन इन करें",
    "login.submit": "साइन इन",
    "login.noAccount": "खाता नहीं है?",
    "register.title": "अपना AgroDoc खाता बनाएँ",
    "register.submit": "खाता बनाएँ",
    "register.haveAccount": "पहले से खाता है?",
  },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem("agrodoc.lang") as Lang) || "en",
  );

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("agrodoc.lang", l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string) => translations[lang][key] ?? translations.en[key] ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
