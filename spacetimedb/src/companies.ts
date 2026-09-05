// Seed rows for the public `company` table, generated from src/data/companies.json.
// Edit that JSON, not this file: the client reads the same list, and a second
// hand-maintained copy is how the two drift apart. Regenerate with the snippet
// in docs/DATA-MODEL.md.
//
// `id` is the row's position in the JSON, `slug` is the lower-cased name with
// every non-alphanumeric run replaced by '-', and the first twelve are featured.

export interface CompanySeed {
  id: number;
  slug: string;
  name: string;
  domain: string;
  hqArea: string;
  lng: number;
  lat: number;
  category: string;
  logo: string;
  featured: boolean;
}

export const COMPANIES: CompanySeed[] = [
  { id: 0, slug: "flipkart", name: "Flipkart", domain: "flipkart.com", hqArea: "Bellandur", lng: 77.69, lat: 12.93, category: "ecommerce", logo: "https://www.google.com/s2/favicons?domain=flipkart.com&sz=128", featured: true },
  { id: 1, slug: "myntra", name: "Myntra", domain: "myntra.com", hqArea: "Bellandur", lng: 77.69, lat: 12.93, category: "ecommerce", logo: "https://www.google.com/s2/favicons?domain=myntra.com&sz=128", featured: true },
  { id: 2, slug: "swiggy", name: "Swiggy", domain: "swiggy.com", hqArea: "Kadubeesanahalli", lng: 77.7, lat: 12.94, category: "foodtech", logo: "https://www.google.com/s2/favicons?domain=swiggy.com&sz=128", featured: true },
  { id: 3, slug: "ola", name: "Ola", domain: "olacabs.com", hqArea: "Koramangala", lng: 77.62, lat: 12.93, category: "mobility", logo: "https://www.google.com/s2/favicons?domain=olacabs.com&sz=128", featured: true },
  { id: 4, slug: "razorpay", name: "Razorpay", domain: "razorpay.com", hqArea: "Koramangala", lng: 77.62, lat: 12.93, category: "fintech", logo: "https://www.google.com/s2/favicons?domain=razorpay.com&sz=128", featured: true },
  { id: 5, slug: "phonepe", name: "PhonePe", domain: "phonepe.com", hqArea: "Bellandur", lng: 77.68, lat: 12.93, category: "fintech", logo: "https://www.google.com/s2/favicons?domain=phonepe.com&sz=128", featured: true },
  { id: 6, slug: "freshworks", name: "Freshworks", domain: "freshworks.com", hqArea: "Kadubeesanahalli", lng: 77.7, lat: 12.94, category: "saas", logo: "https://www.google.com/s2/favicons?domain=freshworks.com&sz=128", featured: true },
  { id: 7, slug: "zerodha", name: "Zerodha", domain: "zerodha.com", hqArea: "JP Nagar", lng: 77.59, lat: 12.9, category: "fintech", logo: "https://www.google.com/s2/favicons?domain=zerodha.com&sz=128", featured: true },
  { id: 8, slug: "cred", name: "CRED", domain: "cred.club", hqArea: "Koramangala", lng: 77.62, lat: 12.93, category: "fintech", logo: "https://www.google.com/s2/favicons?domain=cred.club&sz=128", featured: true },
  { id: 9, slug: "meesho", name: "Meesho", domain: "meesho.com", hqArea: "Koramangala", lng: 77.62, lat: 12.93, category: "ecommerce", logo: "https://www.google.com/s2/favicons?domain=meesho.com&sz=128", featured: true },
  { id: 10, slug: "byju-s", name: "BYJU'S", domain: "byjus.com", hqArea: "Bannerghatta Road", lng: 77.6, lat: 12.9, category: "edtech", logo: "https://www.google.com/s2/favicons?domain=byjus.com&sz=128", featured: true },
  { id: 11, slug: "unacademy", name: "Unacademy", domain: "unacademy.com", hqArea: "Indiranagar", lng: 77.64, lat: 12.97, category: "edtech", logo: "https://www.google.com/s2/favicons?domain=unacademy.com&sz=128", featured: true },
  { id: 12, slug: "vedantu", name: "Vedantu", domain: "vedantu.com", hqArea: "HSR Layout", lng: 77.64, lat: 12.91, category: "edtech", logo: "https://www.google.com/s2/favicons?domain=vedantu.com&sz=128", featured: false },
  { id: 13, slug: "dunzo", name: "Dunzo", domain: "dunzo.com", hqArea: "Koramangala", lng: 77.62, lat: 12.93, category: "quick-commerce", logo: "https://www.google.com/s2/favicons?domain=dunzo.com&sz=128", featured: false },
  { id: 14, slug: "inmobi", name: "InMobi", domain: "inmobi.com", hqArea: "CV Raman Nagar", lng: 77.66, lat: 12.98, category: "adtech", logo: "https://www.google.com/s2/favicons?domain=inmobi.com&sz=128", featured: false },
  { id: 15, slug: "practo", name: "Practo", domain: "practo.com", hqArea: "Koramangala", lng: 77.61, lat: 12.94, category: "healthtech", logo: "https://www.google.com/s2/favicons?domain=practo.com&sz=128", featured: false },
  { id: 16, slug: "sharechat", name: "ShareChat", domain: "sharechat.com", hqArea: "Domlur", lng: 77.64, lat: 12.96, category: "social", logo: "https://www.google.com/s2/favicons?domain=sharechat.com&sz=128", featured: false },
  { id: 17, slug: "slice", name: "Slice", domain: "sliceit.com", hqArea: "Domlur", lng: 77.64, lat: 12.96, category: "fintech", logo: "https://www.google.com/s2/favicons?domain=sliceit.com&sz=128", featured: false },
  { id: 18, slug: "groww", name: "Groww", domain: "groww.in", hqArea: "Koramangala", lng: 77.62, lat: 12.93, category: "fintech", logo: "https://www.google.com/s2/favicons?domain=groww.in&sz=128", featured: false },
  { id: 19, slug: "ather-energy", name: "Ather Energy", domain: "atherenergy.com", hqArea: "Bellandur", lng: 77.65, lat: 12.92, category: "ev-mobility", logo: "https://www.google.com/s2/favicons?domain=atherenergy.com&sz=128", featured: false },
  { id: 20, slug: "yulu", name: "Yulu", domain: "yulu.bike", hqArea: "HSR Layout", lng: 77.65, lat: 12.92, category: "mobility", logo: "https://www.google.com/s2/favicons?domain=yulu.bike&sz=128", featured: false },
  { id: 21, slug: "licious", name: "Licious", domain: "licious.in", hqArea: "HSR Layout", lng: 77.64, lat: 12.91, category: "d2c-foodtech", logo: "https://www.google.com/s2/favicons?domain=licious.in&sz=128", featured: false },
  { id: 22, slug: "bigbasket", name: "BigBasket", domain: "bigbasket.com", hqArea: "Bellandur", lng: 77.68, lat: 12.93, category: "ecommerce", logo: "https://www.google.com/s2/favicons?domain=bigbasket.com&sz=128", featured: false },
  { id: 23, slug: "wipro", name: "Wipro", domain: "wipro.com", hqArea: "Sarjapur Road", lng: 77.69, lat: 12.9, category: "it-services", logo: "https://www.google.com/s2/favicons?domain=wipro.com&sz=128", featured: false },
  { id: 24, slug: "mygate", name: "MyGate", domain: "mygate.in", hqArea: "Bellandur", lng: 77.68, lat: 12.93, category: "proptech", logo: "https://www.google.com/s2/favicons?domain=mygate.in&sz=128", featured: false },
  { id: 25, slug: "leadsquared", name: "LeadSquared", domain: "leadsquared.com", hqArea: "Domlur", lng: 77.64, lat: 12.96, category: "saas", logo: "https://www.google.com/s2/favicons?domain=leadsquared.com&sz=128", featured: false },
  { id: 26, slug: "moengage", name: "MoEngage", domain: "moengage.com", hqArea: "Domlur", lng: 77.64, lat: 12.96, category: "martech", logo: "https://www.google.com/s2/favicons?domain=moengage.com&sz=128", featured: false },
  { id: 27, slug: "whatfix", name: "Whatfix", domain: "whatfix.com", hqArea: "HSR Layout", lng: 77.64, lat: 12.91, category: "saas", logo: "https://www.google.com/s2/favicons?domain=whatfix.com&sz=128", featured: false },
  { id: 28, slug: "netradyne", name: "Netradyne", domain: "netradyne.com", hqArea: "Bellandur", lng: 77.68, lat: 12.93, category: "ai-mobility", logo: "https://www.google.com/s2/favicons?domain=netradyne.com&sz=128", featured: false },
  { id: 29, slug: "cult-fit", name: "cult.fit", domain: "cult.fit", hqArea: "Bellandur", lng: 77.68, lat: 12.93, category: "healthtech", logo: "https://www.google.com/s2/favicons?domain=cult.fit&sz=128", featured: false },
  { id: 30, slug: "ninjacart", name: "Ninjacart", domain: "ninjacart.com", hqArea: "Sarjapur Road", lng: 77.69, lat: 12.9, category: "agritech", logo: "https://www.google.com/s2/favicons?domain=ninjacart.com&sz=128", featured: false },
  { id: 31, slug: "nobroker", name: "NoBroker", domain: "nobroker.in", hqArea: "Bellandur", lng: 77.68, lat: 12.92, category: "proptech", logo: "https://www.google.com/s2/favicons?domain=nobroker.in&sz=128", featured: false },
  { id: 32, slug: "infosys", name: "Infosys", domain: "infosys.com", hqArea: "Electronic City", lng: 77.66, lat: 12.84, category: "it-services", logo: "https://www.google.com/s2/favicons?domain=infosys.com&sz=128", featured: false },
  { id: 33, slug: "observe-ai", name: "Observe.AI", domain: "observe.ai", hqArea: "Indiranagar", lng: 77.64, lat: 12.97, category: "ai-voicetech", logo: "https://www.google.com/s2/favicons?domain=observe.ai&sz=128", featured: false },
  { id: 34, slug: "increff", name: "Increff", domain: "increff.com", hqArea: "HSR Layout", lng: 77.64, lat: 12.91, category: "retail-saas", logo: "https://www.google.com/s2/favicons?domain=increff.com&sz=128", featured: false },
  { id: 35, slug: "finbox", name: "FinBox", domain: "finbox.in", hqArea: "Indiranagar", lng: 77.64, lat: 12.97, category: "fintech-infra", logo: "https://www.google.com/s2/favicons?domain=finbox.in&sz=128", featured: false },
  { id: 36, slug: "kreditbee", name: "KreditBee", domain: "kreditbee.in", hqArea: "HSR Layout", lng: 77.64, lat: 12.91, category: "fintech", logo: "https://www.google.com/s2/favicons?domain=kreditbee.in&sz=128", featured: false },
  { id: 37, slug: "cuemath", name: "Cuemath", domain: "cuemath.com", hqArea: "Bellandur", lng: 77.68, lat: 12.93, category: "edtech", logo: "https://www.google.com/s2/favicons?domain=cuemath.com&sz=128", featured: false },
  { id: 38, slug: "zetwerk", name: "Zetwerk", domain: "zetwerk.com", hqArea: "HSR Layout", lng: 77.64, lat: 12.91, category: "manufacturing-marketplace", logo: "https://www.google.com/s2/favicons?domain=zetwerk.com&sz=128", featured: false },
];
