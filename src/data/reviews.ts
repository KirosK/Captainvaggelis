import type { PropertyKey } from './types'

export type Traveller = 'couple' | 'family' | 'group' | 'solo'

export type Review = {
  id: string
  property: PropertyKey
  name: string
  country: string
  /** ISO language of the original text */
  lang: 'en' | 'it' | 'el'
  score: number
  /** YYYY-MM of the review on Booking.com (the month facts.md records; the field name is historical) */
  stayed: string
  /** only where the review states it */
  traveller?: Traveller
  room?: string
  title?: string
  text: string
  /** mentions the cruises — reused on cruise pages */
  cruise?: boolean
  featured?: boolean
}

// Verbatim excerpts from verified Booking.com reviews (October 2026). Cuts are marked with "…".
export const reviews: Review[] = [
  {
    id: 'ag-vicky', property: 'aegealis', name: 'Vicky', country: 'GB', lang: 'en', score: 10, stayed: '2026-09',
    text: 'Have stayed here for the 4th time, amazing location. The lady who does the cleaning, such a sweet heart and made our room lovely everyday.',
    featured: true,
  },
  {
    id: 'ag-amy', property: 'aegealis', name: 'Amy', country: 'GB', lang: 'en', score: 10, stayed: '2025-05',
    title: 'Perfect babymoon :)',
    text: "We had room 6 … with a large balcony directly facing the sea. We couldn't have asked for more from the apartment, cleaned daily & bed made, little kitchenette with fridge, perfect location for any restaurant you could want, the beach and sea literally across the road. … He offers you 20% off his boat trips (definitely do the Ithaca one) … The maid was a daily delight, don't hesitate to book.",
    cruise: true, featured: true,
  },
  {
    id: 'ag-swift', property: 'aegealis', name: 'Swift', country: 'GB', lang: 'en', score: 8, stayed: '2026-10',
    text: "The apartment was in beautiful condition, absolutely spotless, cleaned every day by the lovely Maria … Location is fantastic, just cross the road and you're on the beach, and you have the use of two pools at either side of the property … about a ten minute walk into the town centre with literally loads of restaurants and bars. We just love Skala!",
  },
  {
    id: 'ag-kathryn', property: 'aegealis', name: 'Kathryn', country: 'GB', lang: 'en', score: 10, stayed: '2026-08', traveller: 'family',
    text: 'The location of the property was perfect. The apartment was directly opposite the beach with 2 lovely hotels either side where you could use their pool facilities. The apartment was cleaned every day and beds were very comfortable. All the staff and owners were very accommodating and loved to chat, nothing was ever too much bother.',
    featured: true,
  },
  {
    id: 'ag-catrin', property: 'aegealis', name: 'Catrin', country: 'GB', lang: 'en', score: 9, stayed: '2026-08', traveller: 'family',
    text: "Great location and really good value for money. Super useful to have a little kitchen so you can have breakfast on the balcony etc and you have much more space than the other hotels on the seafront. So easy to use the pools next door and they were super friendly there too!",
  },
  {
    id: 'ag-krzysztof', property: 'aegealis', name: 'Krzysztof', country: 'GB', lang: 'en', score: 10, stayed: '2026-05',
    text: 'Very friendly, courteous service. The staff is exceptionally hospitable. The owner, Captain Vangelis, deserves special recognition. He is a golden man, incredibly caring and attentive to detail, ensuring his guests have a wonderful time.',
    featured: true,
  },
  {
    id: 'ag-iulia', property: 'aegealis', name: 'Iulia', country: 'RO', lang: 'en', score: 10, stayed: '2025-09',
    title: 'Greatest accommodation in Skala',
    text: "We couldn't have asked for more. Very clean, right across the beach, access to two swimming pools at the hotels nearby, great location to get around the island. … also you get 20% off for any cruise with Captain Vangelis, a cruise we 10000% loved.",
    cruise: true, featured: true,
  },
  {
    id: 'ag-bella', property: 'aegealis', name: 'Bella', country: 'GB', lang: 'en', score: 10, stayed: '2025-09', traveller: 'solo',
    title: 'Frosso and Vangelis are absolutely perfect hosts!',
    text: 'Lovely spotlessly clean room. Everything I could possibly need. Room price was very competitive with surrounding hotels. Already booked again for next year.',
  },
  {
    id: 'ag-inga', property: 'aegealis', name: 'Inga', country: 'CH', lang: 'en', score: 10, stayed: '2026-06',
    text: 'Amazing view, everything very clean, big balcony. Location perfect.',
  },
  {
    id: 'ag-claire', property: 'aegealis', name: 'Claire', country: 'GB', lang: 'en', score: 10, stayed: '2026-07',
    text: "Location, balcony facing the sea, double glazing so no noise from hotels either side and lovely shower room. They actually cleaned our room and made up the beds everyday – outstanding thank you.",
  },
  {
    id: 'ag-fabio', property: 'aegealis', name: 'Fabio', country: 'IT', lang: 'en', score: 10, stayed: '2025-08',
    text: 'Wonderful location close to the beach and the town, very comfortable bed, practical shower and kitchen, the patio and the garden are super, good parking. Good a/c and good WiFi. Kind and helpful staff. 10 to the cleanliness.',
  },
  {
    id: 'ag-roberto', property: 'aegealis', name: 'Roberto', country: 'IT', lang: 'it', score: 10, stayed: '2026-09',
    text: 'La posizione proprio di fronte alla spiaggia e la pulizia quotidiana.',
  },
  {
    id: 'ag-maria', property: 'aegealis', name: 'Maria', country: 'GR', lang: 'el', score: 10, stayed: '2024-08',
    text: 'Είχε όλες τις ανέσεις για άνετη διαμονή, καθημερινή καθαριότητα, 50 μέτρα από την παραλία και σε κοντινή απόσταση είχε μάρκετ, καφέ, εστιατόρια.',
  },
  {
    id: 'ag-lesley', property: 'aegealis', name: 'Lesley', country: 'GB', lang: 'en', score: 10, stayed: '2025-06',
    text: 'Excellent location directly opposite the beach. Spacious studio. Thorough cleaning every day. We loved it and are already discussing when we can return.',
  },
  {
    id: 'ag-kirsty', property: 'aegealis', name: 'Kirsty', country: 'GB', lang: 'en', score: 8, stayed: '2026-06',
    text: "Location was absolutely perfect, right on the beach and a very short walk to the main High Street. … Good mosquito nets … Shower was fab! Hosts were very accommodating and even organised a buggy at short notice!",
  },
  {
    id: 'ag-clare', property: 'aegealis', name: 'Clare', country: 'GB', lang: 'en', score: 10, stayed: '2026-10', traveller: 'group',
    title: 'Wonderful, we will be back!',
    text: 'Perfect location, very comfortable beds and lovely people.',
  },
  {
    id: 'ag-marsha', property: 'aegealis', name: 'Marsha', country: 'US', lang: 'en', score: 9, stayed: '2024-10',
    text: 'Nice location and wonderful staff! Maria was very friendly and kept our room spotless. Captain Vangelis was very nice as well. A nice perk was being able to use the pools at either hotel next to us.',
  },

  {
    id: 'th-kelly', property: 'theodora', name: 'Kelly', country: 'GB', lang: 'en', score: 10, stayed: '2026-07',
    text: "On arrival you have cold water already in your fridge which for s/c is unheard of. Location fantastic, was so clean they cleaned them everyday and clean towels even on a weekend. Couldn't fault this accommodation, the owners and maid were so lovely, truly recommend this place and their boat trip offers well worth a fun filled day out. Will be going back for sure and taking our family. Thank you Vangelis & Frosso",
    cruise: true, featured: true,
  },
  {
    id: 'th-jason', property: 'theodora', name: 'Jason', country: 'GB', lang: 'en', score: 10, stayed: '2026-08', traveller: 'family', room: 'Triple Room with Terrace',
    text: "I have been travelling to Kefalonia on and off for over 20 years, this was my first stay at the Theodora studios and apartments and I was with my 4 year old daughter. Having stayed in Skala many times at various places I was really impressed with our stay here, from the welcome on arrival. The studio was perfect, plenty of space, clean, a great kitchenette which was very well equipped, the location was great for us at the top of the Main Street! The hosts were fantastic, really helpful and I would definitely recommend Theodora.",
    featured: true,
  },
  {
    id: 'th-anne', property: 'theodora', name: 'Anne', country: 'GB', lang: 'en', score: 10, stayed: '2026-09',
    title: 'Perfect!',
    text: "Fabulous host, met us when we arrived even though it was very late. The apartment was immaculately clean and very comfortable. Cleaning lady came in every day, made bed and changed towels. … Beach 10 mins walk away and restaurants, shops, bars etc very close.",
    featured: true,
  },
  {
    id: 'th-susanna', property: 'theodora', name: 'Susanna', country: 'GB', lang: 'en', score: 10, stayed: '2026-08', traveller: 'solo',
    title: 'Beautiful energy!',
    text: "The outside with a view of vines … this place had the most beautiful energy, family run, by a wonderful family. I was travelling alone, as a female and would have loved to have stayed longer, will certainly be back!",
    featured: true,
  },
  {
    id: 'th-keith', property: 'theodora', name: 'Keith', country: 'GB', lang: 'en', score: 10, stayed: '2024-06',
    title: 'Perfect – All we wanted, and then some.',
    text: "A five minute stroll down to the beach via the colourful, easy-going high street full of shops, bars and restaurants. … Our hosts were superb, welcoming, fun, full of useful info and very accommodating. … Captain Vangelis' fabulous boat trips were organised for us (with a very healthy discount!) and airport taxi transfers arranged … It was all so easy and we left very happy and relaxed.",
    cruise: true, featured: true,
  },
  {
    id: 'th-george', property: 'theodora', name: 'George', country: 'GB', lang: 'en', score: 10, stayed: '2024-06',
    title: 'The perfect stay for Skala',
    text: "… so close to the centre and beach but also based in a quiet area. Plenty of sunbeds and a pool to use. A special thank you to Froso for being an incredible host … it was my partner's birthday and I asked about a florist, not only did she go out of her way to get them, the housekeeping arranged them on the bed.",
  },
  {
    id: 'th-evelyn', property: 'theodora', name: 'Evelyn', country: 'CH', lang: 'en', score: 10, stayed: '2025-06', traveller: 'solo', room: 'Studio – Top Floor',
    text: "I had a lovely stay in a nice, always cleaned room with seaview on the 2nd floor. … Theodora Studio is extremely good situated if you have no car: 1 min. to the next supermarket and 5 minutes walk to various restaurants and the beautiful beach.",
  },
  {
    id: 'th-emily', property: 'theodora', name: 'Emily', country: 'GB', lang: 'en', score: 10, stayed: '2026-09', traveller: 'family',
    text: "Beautiful clean spacious and comfortable apartment. Just far enough away from the town so it's quiet but not too far that it's a big walk home.",
  },
  {
    id: 'th-helen', property: 'theodora', name: 'Helen', country: 'GB', lang: 'en', score: 9, stayed: '2024-07', traveller: 'solo',
    text: "Hosts went above and beyond … We also enjoyed our cruise to Ithaca with Captain Vangelis Cruises, which the apartments give you 20% off, Frosso also gave us a lift to the beach! …",
    cruise: true,
  },
  {
    id: 'th-kamila', property: 'theodora', name: 'Kamila', country: 'CZ', lang: 'en', score: 9, stayed: '2025-08', traveller: 'family',
    text: "Everything was great, the studio was clean, cleaned every day, the swimming pool was great, lovely garden you could relax in. It was close to shops, restaurants and also beach. … we went also to the cruise to Ithaka which was amazing, she booked it for us.",
    cruise: true,
  },
  {
    id: 'th-richard', property: 'theodora', name: 'Richard', country: 'GB', lang: 'en', score: 10, stayed: '2024-10',
    text: "Our hosts were very friendly and gave us a very warm welcome. … The garden behind Theodora was a lovely place to sit and relax. … Just a short walk to the beach and all the bars and restaurants. Ideal..",
  },
  {
    id: 'th-spinksy', property: 'theodora', name: 'Spinksy8', country: 'GB', lang: 'en', score: 9, stayed: '2025-09', traveller: 'group',
    text: "Excellent value for money. Location just above main strip of Skala with all the restaurants and bars. … Frosso the owner was an excellent host. Super friendly and made staying here a pleasure.",
  },
  {
    id: 'th-martyn', property: 'theodora', name: 'Martyn', country: 'GB', lang: 'en', score: 10, stayed: '2026-09',
    text: "Really clean and very comfortable bed. Everyday the apartment was serviced … Excellent value for money and really easy to deal with.",
  },
  {
    id: 'th-lisa', property: 'theodora', name: 'Lisa', country: 'GB', lang: 'en', score: 10, stayed: '2025-08', traveller: 'family',
    text: "Brilliant location very near the town centre & beach but just far enough away to be quiet & very relaxing, the studio was beautifully clean & the cleaner came in every day …",
  },
  {
    id: 'th-ana', property: 'theodora', name: 'Ana', country: 'RO', lang: 'en', score: 9, stayed: '2026-08', traveller: 'family', room: 'Two-Bedroom Apartment',
    text: "The apartment was very clean. Cleaning was done daily. … The apartment was decorated with very beautiful handmade paintings. The location was in a very quiet area.",
  },
]

export const ratings = {
  aegealis: { score: 9.1, count: 134, categories: { staff: 9.4, facilities: 8.7, cleanliness: 9.3, comfort: 9.3, value: 9.2, location: 9.9, wifi: 6.2 } },
  theodora: { score: 9.1, count: 140, categories: { staff: 9.5, facilities: 8.8, cleanliness: 9.5, comfort: 9.4, value: 9.2, location: 9.4 } },
} as const
