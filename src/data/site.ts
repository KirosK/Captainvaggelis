export const site = {
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://skala-captain-vangelis.vercel.app').replace(/\/+$/, ''),
  brand: 'Captain Vangelis',
  legalName: 'Captain Vangelis Special Cruises & Apartments',
  founded: '1987',
  phones: [
    { display: '+30 697 269 3260', e164: '+306972693260', whoKey: 'phoneHint' },
    { display: '+30 698 038 6744', e164: '+306980386744', whoKey: 'phone2Hint' },
  ],
  whatsapp: '306972693260',
  email: 'info@kefalonia-cruises.gr',
  address: { locality: 'Skala', region: 'Kefalonia', postalCode: '28086', country: 'GR' },
  kiosk: { lat: 38.07836, lng: 20.80052 },
  sameAs: [
    'https://kefalonia-cruises.gr/',
    'https://www.booking.com/hotel/gr/aegealis.html',
    'https://www.booking.com/hotel/gr/theodora-studios-ap-nts.html',
    'https://www.tripadvisor.com/Attraction_Review-g664630-d2166413-Reviews-Captain_Vangelis_Special_Cruises-Skala_Kefalonia_Ionian_Islands.html',
    'https://www.facebook.com/spathisvangelis/',
  ],
} as const

export const whatsappLink = (text?: string) =>
  `https://wa.me/${site.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`
