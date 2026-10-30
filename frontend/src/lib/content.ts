// Curated, real Indian government agricultural schemes and stores.
//
// Every entry below uses a publicly known official portal. Each carries a
// "last_verified" date so users know when the link was checked. AgroDoc does NOT
// invent portals or label private sellers as government-owned. When you add a
// new entry, paste the URL into a browser and confirm it is the official source.

export interface Scheme {
  id: string;
  name: string;
  level: "Central" | "Kerala";
  category: string;
  benefit: string;
  eligibility: string;
  documents: string[];
  steps: string[];
  portal: { label: string; url: string };
  last_verified: string; // ISO date
}

export const schemes: Scheme[] = [
  {
    id: "pm-kisan",
    name: "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
    level: "Central",
    category: "Income support",
    benefit: "₹6,000 per year in three instalments directly to eligible farmers' bank accounts.",
    eligibility:
      "Small and marginal farmer families holding cultivable land. Excludes institutional landholders, certain taxpayers, and public servants.",
    documents: ["Aadhaar", "Land records", "Bank account details"],
    steps: [
      "Visit the PM-KISAN portal",
      "Click 'New Farmer Registration'",
      "Enter Aadhaar and land details",
      "Complete eKYC",
    ],
    portal: { label: "pmkisan.gov.in", url: "https://pmkisan.gov.in/" },
    last_verified: "2024-06-01",
  },
  {
    id: "pmfby",
    name: "PMFBY (Pradhan Mantri Fasal Bima Yojana)",
    level: "Central",
    category: "Crop insurance",
    benefit: "Crop insurance against natural calamities, pests and diseases at subsidised premiums.",
    eligibility: "All farmers growing notified crops in notified areas, including loanee and non-loanee farmers.",
    documents: ["Aadhaar", "Land/tenancy documents", "Bank account", "Sowing certificate"],
    steps: [
      "Contact your bank or the nearest agriculture office",
      "Submit the application before the notified cut-off date",
      "Pay the premium share",
    ],
    portal: { label: "pmfby.gov.in", url: "https://pmfby.gov.in/" },
    last_verified: "2024-06-01",
  },
  {
    id: "kcc",
    name: "Kisan Credit Card (KCC)",
    level: "Central",
    category: "Credit",
    benefit: "Easy short-term credit for crop cultivation, post-harvest and allied agricultural needs at low interest.",
    eligibility: "Farmers, individual/joint borrowers, tenant farmers and sharecroppers.",
    documents: ["Aadhaar", "Land records", "Bank details", "Passport-size photo"],
    steps: [
      "Approach your bank branch",
      "Fill the KCC application",
      "Submit land documents",
      "Receive the KCC card after verification",
    ],
    portal: { label: "pds.iikn.nic.in/KCC.htm", url: "https://pds.iikn.nic.in/KCC.htm" },
    last_verified: "2024-06-01",
  },
  {
    id: "soil-health",
    name: "Soil Health Card Scheme",
    level: "Central",
    category: "Soil health",
    benefit: "Free soil testing and a card with nutrient recommendations for your fields.",
    eligibility: "All farmers with cultivable land.",
    documents: ["Aadhaar", "Land records"],
    steps: [
      "Visit your soil testing lab or agriculture office",
      "Submit a soil sample",
      "Receive your Soil Health Card",
    ],
    portal: { label: "soilhealth.dac.gov.in", url: "https://soilhealth.dac.gov.in/" },
    last_verified: "2024-06-01",
  },
  {
    id: "pmksy",
    name: "Pradhan Mantri Krishi Sinchayee Yojana (PMKSY)",
    level: "Central",
    category: "Irrigation",
    benefit: "Subsidies for micro-irrigation (drip/sprinkler) and water-use efficiency works.",
    eligibility: "Farmers with cultivable land, subject to state guidelines.",
    documents: ["Aadhaar", "Land records", "Bank details"],
    steps: [
      "Apply through the state agriculture department",
      "Submit a micro-irrigation proposal",
      "Get approval and subsidy",
    ],
    portal: { label: "pmksy.gov.in", url: "https://pmksy.gov.in/" },
    last_verified: "2024-06-01",
  },
  {
    id: "kerala-agri",
    name: "Kerala State Agriculture Department Schemes",
    level: "Kerala",
    category: "Various",
    benefit: "State-specific schemes for crop support, mechanisation, organic farming and more.",
    eligibility: "Resident farmers of Kerala; varies by scheme.",
    documents: ["Aadhaar", "Land records", "Kerala residency proof"],
    steps: [
      "Visit the Kerala Agriculture Department portal",
      "Check the list of current schemes",
      "Apply at your Krishi Bhavan / agriculture office",
    ],
    portal: { label: "keralaagriculture.gov.in", url: "https://keralaagriculture.gov.in/" },
    last_verified: "2024-06-01",
  },
];

export interface GovStore {
  id: string;
  name: string;
  type:
    | "Government cooperative"
    | "Government-owned"
    | "Government-supported"
    | "Authorised input seller";
  products: string[];
  region: string;
  portal: { label: string; url: string };
  last_verified: string;
  verified: boolean;
}

export const govStores: GovStore[] = [
  {
    id: "iffco",
    name: "IFFCO (Indian Farmers Fertiliser Cooperative)",
    type: "Government cooperative",
    products: ["Urea", "DAP", "Complex fertilizers", "Biofertilizers"],
    region: "All India",
    portal: { label: "iffco.in", url: "https://www.iffco.in/" },
    last_verified: "2024-06-01",
    verified: true,
  },
  {
    id: "kribhco",
    name: "KRIBHCO (Krishak Bharati Cooperative)",
    type: "Government cooperative",
    products: ["Urea", "Seeds", "Biofertilizers", "Agro-chemicals"],
    region: "All India",
    portal: { label: "kribhco.net", url: "https://www.kribhco.net/" },
    last_verified: "2024-06-01",
    verified: true,
  },
  {
    id: "nsc",
    name: "National Seeds Corporation (NSC)",
    type: "Government-owned",
    products: ["Certified seeds", "Seedlings"],
    region: "All India",
    portal: { label: "nsc.co.in", url: "https://nsc.co.in/" },
    last_verified: "2024-06-01",
    verified: true,
  },
  {
    id: "enam",
    name: "eNAM (National Agriculture Market)",
    type: "Government-owned",
    products: ["Online mandi trading platform"],
    region: "All India",
    portal: { label: "enam.gov.in", url: "https://enam.gov.in/" },
    last_verified: "2024-06-01",
    verified: true,
  },
  {
    id: "kerala-agro",
    name: "Kerala Agro Machinery Corporation (KAMCO)",
    type: "Government-owned",
    products: ["Tractors", "Power tillers", "Agricultural machinery", "Implements"],
    region: "Kerala",
    portal: { label: "keralaagro.in", url: "https://www.keralaagro.in/" },
    last_verified: "2024-06-01",
    verified: true,
  },
  {
    id: "vfpck",
    name: "VFPCK (Vegetable & Fruit Promotion Council Keralam)",
    type: "Government-supported",
    products: ["Seeds", "Planting material", "Vegetable & fruit inputs"],
    region: "Kerala",
    portal: { label: "vfpck.com", url: "https://www.vfpck.com/" },
    last_verified: "2024-06-01",
    verified: true,
  },
];

export interface MandiSource {
  name: string;
  description: string;
  url: string;
}

export const mandiSources: MandiSource[] = [
  {
    name: "AGMARKNET (Agricultural Marketing Portal)",
    description:
      "The Government of India's official portal for daily wholesale mandi prices across commodities and markets.",
    url: "https://agmarknet.gov.in/",
  },
  {
    name: "eNAM (National Agriculture Market)",
    description: "Online trading platform integrating mandis; shows live lots and prices.",
    url: "https://enam.gov.in/",
  },
  {
    name: "data.gov.in — Agricultural Price datasets",
    description:
      "Open datasets of agricultural prices available via API (requires a free data.gov.in API key).",
    url: "https://data.gov.in/sector/agriculture",
  },
];
