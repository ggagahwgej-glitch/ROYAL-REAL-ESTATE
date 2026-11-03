#!/usr/bin/env python3
"""Single source of truth for the IMPERIAL ROYAL showcase catalogue.

Generates two artifacts that must stay identical:
  * lib/showcase.ts                 - zero-setup demo catalogue used by the app
  * supabase/showcase-setup.sql    - one-paste Supabase setup + seeded rows

Run:  python3 scripts/generate-showcase.py
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

IMG = "/images/"
ASSETS = {
    "cliff": IMG + "showcase-01.jpg",
    "salon": IMG + "showcase-02.jpg",
    "olive": IMG + "showcase-03.jpg",
    "spa": IMG + "showcase-04.jpg",
    "rooftop": IMG + "showcase-05.jpg",
    "palace": IMG + "showcase-06.jpg",
    "library": IMG + "showcase-07.jpg",
    "alpine": IMG + "showcase-08.jpg",
    "hero": IMG + "hero-estate.jpg",
    "interior": IMG + "interior-gallery.jpg",
    "coastal": IMG + "coastal-villa.jpg",
    "penthouse": IMG + "penthouse.jpg",
    "modern": IMG + "modern-residence.jpg",
    "garden": IMG + "garden-residence.jpg",
    "forest": IMG + "forest-residence.jpg",
}

P = []
def add(**kw):
    # GenerateMetadata applies the '%s | Imperial Royal' template; do not
    # duplicate the brand suffix inside the per-property title.
    if kw.get("meta_title"):
        kw["meta_title"] = kw["meta_title"].replace(" | Imperial Royal", "")
    kw.setdefault("status", "published")
    kw.setdefault("country", "India")
    kw.setdefault("currency", "INR")
    kw.setdefault("availability", "available")
    kw.setdefault("featured", False)
    kw.setdefault("lot_sqft", None)
    kw.setdefault("year_built", None)
    kw.setdefault("price_period", None)
    kw.setdefault("map_url", None)
    P.append(kw)

add(slug="azure-cliff-residence", title="The Azure Cliff Residence",
    subtitle="A private headland above the Arabian Sea, where architecture meets the horizon.",
    description="Set on a dramatic headland above the Arabian Sea, The Azure Cliff Residence is a study in restraint and spectacle. Cantilevered stone volumes frame uninterrupted ocean views, while walls of glass dissolve the boundary between the grand salon and the infinity edge. Six suites, a private spa, a cliffside fire terrace and a discreet staff wing make this one of the most singular addresses on the western coast.",
    listing_type="buy", category="Villa", price=485000000, location="Anjuna Cliffs", city="Goa",
    address="Azure Cliff, Anjuna, North Goa 403509", bedrooms=6, bathrooms=7, area_sqft=11200,
    lot_sqft=38400, year_built=2023, featured=True,
    amenities=["Private infinity pool","Sea view","Spa & sauna","Home theatre","Staff quarters","Smart home automation","Private garage","24/7 security","Terrace"],
    features=["Cantilevered stone architecture","Cliffside fire terrace","Private spa and hammam","Chef's kitchen","Glass elevator","Direct coastal frontage"],
    latitude=15.5735, longitude=73.7392, images=["cliff","salon","spa"],
    meta_title="The Azure Cliff Residence · Goa | Imperial Royal",
    meta_description="A six-suite cliffside villa above the Arabian Sea with an infinity pool, private spa and uninterrupted ocean views.")

add(slug="altitude-penthouse-worli", title="Altitude, The Worli Penthouse",
    subtitle="A full-floor sky residence above the shimmering Mumbai skyline.",
    description="Occupying an entire floor of one of Worli's most distinguished towers, Altitude is a sky residence of rare proportion. A double-height salon opens onto a wraparound terrace with a heated infinity edge, while a walnut-panelled library, private lift lobby and dedicated concierge complete an address conceived for complete privacy above the city.",
    listing_type="buy", category="Penthouse", price=372000000, location="Worli Sea Face", city="Mumbai",
    address="Altitude, Worli Sea Face, Mumbai 400018", bedrooms=5, bathrooms=6, area_sqft=9400,
    year_built=2022, featured=True,
    amenities=["Private elevator","Concierge service","Private infinity pool","Home theatre","Gymnasium","Smart home automation","24/7 security","Terrace"],
    features=["Full-floor private lift lobby","Wraparound sky terrace","Double-height salon","Walnut library","Temperature-controlled wine room"],
    latitude=19.0176, longitude=72.8160, images=["rooftop","salon","penthouse"],
    meta_title="Altitude, The Worli Penthouse · Mumbai | Imperial Royal",
    meta_description="A full-floor sky residence with a heated rooftop infinity pool, double-height salon and private lift lobby above the Mumbai skyline.")

add(slug="villa-serene-alibaug", title="Villa Serene, The Olive Grove",
    subtitle="Lime-washed calm, cypress avenues and a long reflecting pool.",
    description="Behind a quiet cypress avenue near the Alibaug coast, Villa Serene is a lime-washed retreat of extraordinary stillness. Deep loggias, hand-plastered walls and a long reflecting pool create a rhythm of shade and light, while six garden suites open onto olive trees and manicured lawns. An unhurried escape, twenty minutes from the jetty.",
    listing_type="buy", category="Villa", price=198000000, location="Awas", city="Alibaug",
    address="Villa Serene, Awas, Alibaug, Maharashtra 402201", bedrooms=6, bathrooms=6, area_sqft=8600,
    lot_sqft=52000, year_built=2021,
    amenities=["Private infinity pool","Landscaped gardens","Staff quarters","Smart home automation","Private garage","Terrace"],
    features=["Olive grove and cypress avenue","Shaded loggia with linen drapes","Reflecting pool","Outdoor dining pavilion","Guest cottage"],
    latitude=18.6410, longitude=72.8680, images=["olive","garden","interior"],
    meta_title="Villa Serene, The Olive Grove · Alibaug | Imperial Royal",
    meta_description="A lime-washed six-suite villa with olive groves, cypress avenues and a long reflecting pool near the Alibaug coast.")

add(slug="calacatta-spa-estate", title="The Calacatta Estate",
    subtitle="Bookmatched marble, still water and the quiet of the Aravalli hills.",
    description="The Calacatta Estate is a private wellness retreat carved from bookmatched Viola marble and warm limestone. A sculptural stone bathing room, hammam, hydrotherapy pool and meditation court form the heart of the residence, while eight suites look across a mist-filled valley toward the Aravalli hills.",
    listing_type="buy", category="Estate", price=265000000, location="Fateh Sagar", city="Udaipur",
    address="The Calacatta Estate, Fateh Sagar Road, Udaipur 313001", bedrooms=8, bathrooms=9, area_sqft=14800,
    lot_sqft=76000, year_built=2020, featured=True,
    amenities=["Spa & sauna","Private infinity pool","Landscaped gardens","Gymnasium","Staff quarters","Fireplace","Italian marble","24/7 security"],
    features=["Bookmatched Calacatta Viola spa","Hydrotherapy pool","Hammam and steam room","Meditation court","Valley-facing suites"],
    latitude=24.5960, longitude=73.6800, images=["spa","palace","interior"],
    meta_title="The Calacatta Estate · Udaipur | Imperial Royal",
    meta_description="An eight-suite wellness estate of bookmatched marble, hammam and hydrotherapy pool overlooking the Aravalli hills.")

add(slug="skyline-terrace-collection", title="The Skyline Terrace Collection",
    subtitle="A curated duplex with a lit rooftop pool above the city lights.",
    description="A rare duplex at the crown of a landmark tower, The Skyline Terrace Collection pairs smoked oak and honed stone with a spectacular illuminated rooftop pool. Floor-to-ceiling glazing frames a panorama of the city, while a private bar, screening room and guest suite make entertaining effortless.",
    listing_type="rent", category="Penthouse", price=1850000, price_period="month", location="Bandra West", city="Mumbai",
    address="Skyline Terrace, Bandra West, Mumbai 400050", bedrooms=4, bathrooms=5, area_sqft=7200,
    year_built=2021, featured=True,
    amenities=["Private infinity pool","Concierge service","Private elevator","Home theatre","Gymnasium","Terrace","24/7 security"],
    features=["Illuminated rooftop pool","Private bar","Screening room","Smoked oak interiors","Panoramic glazing"],
    latitude=19.0596, longitude=72.8295, images=["rooftop","penthouse","salon"],
    meta_title="The Skyline Terrace Collection · Mumbai | Imperial Royal",
    meta_description="A four-bedroom duplex with an illuminated rooftop infinity pool and panoramic city views, available for private letting.")

add(slug="ranjit-vilas-courtyard-palace", title="Ranjit Vilas Courtyard Palace",
    subtitle="Carved sandstone jalis, reflecting pools and Rajputana grandeur.",
    description="A meticulously restored courtyard palace where hand-carved sandstone jalis filter golden light across symmetrical colonnades. Eleven suites, a private durbar hall, a rose-water reflecting pool and acres of walled gardens preserve the craftsmanship of another century with entirely contemporary comfort.",
    listing_type="buy", category="Heritage", price=680000000, location="Amer Road", city="Jaipur",
    address="Ranjit Vilas, Amer Road, Jaipur 302002", bedrooms=11, bathrooms=12, area_sqft=28400,
    lot_sqft=185000, year_built=1896, featured=True,
    amenities=["Landscaped gardens","Staff quarters","Private garage","Fireplace","24/7 security","Terrace","Spa & sauna"],
    features=["Restored sandstone jalis","Private durbar hall","Rose-water reflecting pool","Walled charbagh gardens","Heritage restoration"],
    latitude=26.9550, longitude=75.8500, images=["palace","interior","garden"],
    meta_title="Ranjit Vilas Courtyard Palace · Jaipur | Imperial Royal",
    meta_description="An eleven-suite restored Rajput courtyard palace with carved sandstone jalis, durbar hall and walled charbagh gardens.")

add(slug="walnut-library-manor", title="The Walnut Library Manor",
    subtitle="Emerald velvet, brass picture lights and a lifetime of collected books.",
    description="A deeply private manor in the capital's most guarded enclave. A floor-to-ceiling walnut library, emerald velvet tasting room and marble fireplace anchor the principal wing, while a concealed garden courtyard, wine cellar and six bedroom suites offer complete seclusion behind mature trees.",
    listing_type="buy", category="Mansion", price=415000000, location="Lutyens' Delhi", city="New Delhi",
    address="The Walnut Manor, Lutyens' Bungalow Zone, New Delhi 110001", bedrooms=7, bathrooms=8, area_sqft=16900,
    lot_sqft=64000, year_built=1938,
    amenities=["Wine cellar","Fireplace","Landscaped gardens","Staff quarters","Private garage","24/7 security","Home theatre"],
    features=["Walnut-panelled library","Emerald velvet tasting room","Marble fireplace","Concealed courtyard","Temperature-controlled cellar"],
    latitude=28.6000, longitude=77.2100, images=["library","interior","garden"],
    meta_title="The Walnut Library Manor · New Delhi | Imperial Royal",
    meta_description="A seven-suite Lutyens' Delhi manor with a walnut library, velvet tasting room, wine cellar and walled garden.")

add(slug="alpine-glass-retreat", title="The Alpine Glass Retreat",
    subtitle="Dark timber, still snow and the pink hush of first light.",
    description="At the edge of a deodar forest, The Alpine Glass Retreat is a study in warmth against the cold. Dark timber volumes and double-height glazing frame the peaks in alpenglow, while a stone fire terrace, cedar sauna and five generously proportioned suites make it an exceptional year-round sanctuary.",
    listing_type="buy", category="Villa", price=142000000, location="Old Manali", city="Manali",
    address="Alpine Glass Retreat, Old Manali, Himachal Pradesh 175131", bedrooms=5, bathrooms=6, area_sqft=7800,
    lot_sqft=41000, year_built=2022,
    amenities=["Fireplace","Spa & sauna","Landscaped gardens","Private garage","Terrace","Smart home automation"],
    features=["Double-height peak-facing glazing","Cedar sauna","Stone fire terrace","Heated stone floors","Deodar forest frontage"],
    latitude=32.2490, longitude=77.1890, images=["alpine","forest","interior"],
    meta_title="The Alpine Glass Retreat · Manali | Imperial Royal",
    meta_description="A five-suite dark-timber and glass retreat with cedar sauna, fire terrace and panoramic Himalayan views.")

add(slug="marina-duom-residence", title="Marina Duom Residence",
    subtitle="A waterfront address with a private berth and a glass-walled salon.",
    description="Positioned on a quiet marina channel, Marina Duom pairs a sculptural white facade with a private berth and a glass-walled salon that opens directly onto the water. Four suites, a rooftop terrace and a discreet crew annex make it equally suited to long summers and effortless entertaining.",
    listing_type="buy", category="Waterfront", price=312000000, location="Palm Jumeirah", city="Dubai",
    country="United Arab Emirates", currency="AED", price_period=None,
    address="Marina Duom, Palm Jumeirah, Dubai", bedrooms=5, bathrooms=6, area_sqft=9100,
    lot_sqft=22000, year_built=2023, featured=True,
    amenities=["Private beach access","Sea view","Private infinity pool","Concierge service","Smart home automation","Terrace","24/7 security"],
    features=["Private berth","Glass-walled waterfront salon","Rooftop terrace","Crew annex","Direct beach access"],
    latitude=25.1124, longitude=55.1390, images=["coastal","cliff","salon"],
    meta_title="Marina Duom Residence · Dubai | Imperial Royal",
    meta_description="A five-suite Palm Jumeirah waterfront residence with a private berth, glass salon and direct beach access.")

add(slug="mayfair-garden-square", title="Mayfair Garden Square",
    subtitle="A Georgian townhouse reimagined with quiet contemporary precision.",
    description="A Grade II listed Georgian townhouse overlooking a private garden square, restored with extraordinary restraint. Original cornices and staircase sit alongside a minimalist rear extension of glass and limestone, a subterranean wellness level and five beautifully proportioned bedroom suites.",
    listing_type="buy", category="Heritage", price=9850000, currency="GBP", location="Mayfair", city="London",
    country="United Kingdom",
    address="Mayfair Garden Square, London W1K", bedrooms=5, bathrooms=5, area_sqft=8200,
    lot_sqft=6200, year_built=1788,
    amenities=["Spa & sauna","Gymnasium","Wine cellar","Landscaped gardens","Staff quarters","Fireplace","Smart home automation"],
    features=["Grade II Georgian restoration","Glass and limestone rear extension","Subterranean wellness level","Private garden square key","Original staircase"],
    latitude=51.5090, longitude=-0.1490, images=["interior","library","garden"],
    meta_title="Mayfair Garden Square · London | Imperial Royal",
    meta_description="A restored five-bedroom Georgian townhouse on a private Mayfair garden square with a subterranean wellness level.")

add(slug="the-pergola-house-lonavala", title="The Pergola House",
    subtitle="Rain-fed gardens, deep verandas and monsoon light.",
    description="Above a mist-filled valley, The Pergola House is a low-slung stone and timber residence designed around the monsoon. Deep verandas, a shaded pergola walk and a long lap pool blur the line between house and garden, while five suites and a separate studio offer generous space for extended stays.",
    listing_type="buy", category="Villa", price=129000000, location="Khandala Ridge", city="Lonavala",
    address="The Pergola House, Khandala Ridge, Lonavala 410401", bedrooms=5, bathrooms=5, area_sqft=8100,
    lot_sqft=58000, year_built=2019,
    amenities=["Private infinity pool","Landscaped gardens","Fireplace","Staff quarters","Terrace","Private garage"],
    features=["Pergola garden walk","Deep monsoon verandas","Valley-facing lap pool","Separate artist's studio","Rain-fed gardens"],
    latitude=18.7540, longitude=73.4070, images=["garden","modern","interior"],
    meta_title="The Pergola House · Lonavala | Imperial Royal",
    meta_description="A five-suite stone and timber hill residence with deep verandas, a pergola garden walk and a valley-facing lap pool.")

add(slug="imperial-brasserie-apartment", title="The Imperial Brasserie Apartment",
    subtitle="A grand pied-à-terre with a chef's kitchen and a private terrace.",
    description="A beautifully scaled apartment in a landmark building, conceived for those who entertain. A chef's kitchen in honed stone opens to a long dining gallery, while a private planted terrace, three generous suites and a dedicated study create a genuine city home rather than a pied-à-terre.",
    listing_type="rent", category="Apartment", price=620000, price_period="month", location="Indiranagar", city="Bengaluru",
    address="The Imperial Brasserie, Indiranagar, Bengaluru 560038", bedrooms=3, bathrooms=4, area_sqft=4800,
    year_built=2020,
    amenities=["Concierge service","Terrace","Gymnasium","Smart home automation","Private garage","24/7 security"],
    features=["Chef's kitchen in honed stone","Long dining gallery","Planted private terrace","Dedicated study","Landmark building"],
    latitude=12.9719, longitude=77.6412, images=["interior","salon","penthouse"],
    meta_title="The Imperial Brasserie Apartment · Bengaluru | Imperial Royal",
    meta_description="A three-suite entertaining apartment with a chef's kitchen, dining gallery and planted private terrace in Indiranagar.")

add(slug="backwater-teak-residence", title="The Backwater Teak Residence",
    subtitle="Reclaimed teak, still water and the hush of the Kerala backwaters.",
    description="Built almost entirely from reclaimed teak and laterite, this residence follows the water's edge through a sequence of shaded pavilions. A private jetty, open-air bathing courts and six suites frame the backwaters at every turn, with a canoe house and spice garden completing the estate.",
    listing_type="buy", category="Waterfront", price=176000000, location="Vembanad Lake", city="Kochi",
    address="Backwater Teak Residence, Vembanad Lake, Kerala 688001", bedrooms=6, bathrooms=6, area_sqft=9800,
    lot_sqft=72000, year_built=2018,
    amenities=["Private beach access","River view","Landscaped gardens","Staff quarters","Terrace","Spa & sauna"],
    features=["Reclaimed teak pavilions","Private jetty","Open-air bathing courts","Spice garden","Canoe house"],
    latitude=9.8400, longitude=76.3400, images=["forest","garden","coastal"],
    meta_title="The Backwater Teak Residence · Kochi | Imperial Royal",
    meta_description="A six-suite reclaimed-teak residence with a private jetty, open-air bathing courts and direct Vembanad backwater frontage.")

add(slug="aurum-crescent-suite", title="The Aurum Crescent Suite",
    subtitle="A serene serviced residence above the orchard district.",
    description="A softly lit, fully serviced residence designed for longer stays. Ivory bouclé, pale oak and brushed brass set a calm palette, while a generous terrace, a quiet study and housekeeping provide the ease of a private hotel with the space of a home.",
    listing_type="rent", category="Apartment", price=480000, price_period="month", location="Jubilee Hills", city="Hyderabad",
    address="Aurum Crescent, Jubilee Hills, Hyderabad 500033", bedrooms=3, bathrooms=3, area_sqft=4200,
    year_built=2022,
    amenities=["Concierge service","Housekeeping","Gymnasium","Smart home automation","Terrace","24/7 security"],
    features=["Fully serviced residence","Pale oak and ivory bouclé palette","Generous planted terrace","Quiet study","Daily housekeeping"],
    latitude=17.4310, longitude=78.4060, images=["salon","interior","penthouse"],
    meta_title="The Aurum Crescent Suite · Hyderabad | Imperial Royal",
    meta_description="A three-bedroom fully serviced residence with a planted terrace, daily housekeeping and concierge in Jubilee Hills.")

add(slug="colonial-veranda-house", title="The Colonial Veranda House",
    subtitle="Shuttered windows, terracotta floors and a walled tropical garden.",
    description="In the quiet French quarter, a restored colonial townhouse of shuttered windows, terracotta floors and deep shaded verandas. A walled tropical garden with a limewashed plunge pool sits at its heart, surrounded by four bedroom suites and a breezy upper gallery.",
    listing_type="buy", category="Heritage", price=96000000, location="White Town", city="Pondicherry",
    address="The Veranda House, White Town, Puducherry 605001", bedrooms=4, bathrooms=4, area_sqft=6200,
    lot_sqft=14000, year_built=1904,
    amenities=["Private infinity pool","Landscaped gardens","Staff quarters","Terrace","Fireplace"],
    features=["Restored colonial shutters","Walled tropical garden","Limewashed plunge pool","Upper breezy gallery","Terracotta floors"],
    latitude=11.9330, longitude=79.8340, images=["garden","olive","interior"],
    meta_title="The Colonial Veranda House · Pondicherry | Imperial Royal",
    meta_description="A restored four-suite colonial townhouse in White Town with shuttered verandas and a walled tropical garden pool.")

add(slug="ridge-line-modernist", title="The Ridge Line Modernist",
    subtitle="A glass-and-stone composition set along a forested ridge.",
    description="A rigorous modernist composition of board-formed concrete, glass and local stone, set lengthwise along a forested ridge. A long central gallery organises the plan, with a suspended fireplace, five suites and a lap pool that appears to spill into the treeline beyond.",
    listing_type="buy", category="Villa", price=158000000, location="Mussoorie Ridge", city="Mussoorie",
    address="Ridge Line Modernist, Mussoorie, Uttarakhand 248179", bedrooms=5, bathrooms=6, area_sqft=8900,
    lot_sqft=66000, year_built=2021,
    amenities=["Private infinity pool","Fireplace","Smart home automation","Landscaped gardens","Private garage","Terrace"],
    features=["Board-formed concrete","Suspended fireplace","Long central gallery","Treeline lap pool","Local stone cladding"],
    latitude=30.4590, longitude=78.0730, images=["modern","forest","spa"],
    meta_title="The Ridge Line Modernist · Mussoorie | Imperial Royal",
    meta_description="A five-suite board-formed concrete and glass residence along a forested Himalayan ridge with a treeline lap pool.")

add(slug="riverstone-haveli", title="The Riverstone Haveli",
    subtitle="A riverside courtyard home of carved stone and quiet water.",
    description="A contemporary haveli on the river's edge, built around a shaded central court with a still water channel. Carved stone screens, a rooftop pavilion and seven suites create a rhythm of cool interiors and open sky, with a private ghat and walled orchard below.",
    listing_type="buy", category="Estate", price=224000000, location="Rishikesh Enclave", city="Rishikesh",
    address="Riverstone Haveli, Rishikesh, Uttarakhand 249201", bedrooms=7, bathrooms=8, area_sqft=13200,
    lot_sqft=88000, year_built=2017,
    amenities=["River view","Landscaped gardens","Staff quarters","Spa & sauna","Terrace","Fireplace","Private garage"],
    features=["Shaded central court","Carved stone jali screens","Rooftop river pavilion","Private ghat","Walled orchard"],
    latitude=30.0860, longitude=78.2680, images=["palace","coastal","garden"],
    meta_title="The Riverstone Haveli · Rishikesh | Imperial Royal",
    meta_description="A seven-suite riverside haveli with a shaded water court, carved stone screens, rooftop pavilion and private ghat.")

add(slug="cedar-house-shimla", title="Cedar House, The Old Estate",
    subtitle="A heritage hill bungalow wrapped in cedar and afternoon light.",
    description="One of the last intact hill bungalows on the old estate road, Cedar House has been carefully renewed rather than remade. Original cedar panelling, bay windows and a stone fireplace remain, joined by a discreet new wing, a glass conservatory and five serene bedroom suites among the pines.",
    listing_type="rent", category="Heritage", price=390000, price_period="month", location="The Mall Road Estate", city="Shimla",
    address="Cedar House, Old Estate Road, Shimla 171002", bedrooms=5, bathrooms=5, area_sqft=7100,
    lot_sqft=38000, year_built=1912,
    amenities=["Fireplace","Landscaped gardens","Staff quarters","Terrace","Private garage","Home theatre"],
    features=["Original cedar panelling","Bay windows","Stone fireplace","Glass conservatory","Heritage renewal"],
    latitude=31.1040, longitude=77.1730, images=["forest","library","interior"],
    meta_title="Cedar House, The Old Estate · Shimla | Imperial Royal",
    meta_description="A renewed five-suite heritage hill bungalow of cedar panelling, bay windows, stone fireplace and glass conservatory.")

add(slug="harbour-light-apartment", title="The Harbour Light Apartment",
    subtitle="A corner residence with two terraces and an uninterrupted harbour view.",
    description="A light-filled corner residence high above the harbour, with two planted terraces and glazing on three sides. An open salon, a calm principal suite and a flexible third room make it an ideal city base, with concierge, secure parking and a residents' pool below.",
    listing_type="rent", category="Apartment", price=720000, price_period="month", location="Marine Drive", city="Mumbai",
    address="Harbour Light, Marine Drive, Mumbai 400020", bedrooms=3, bathrooms=3, area_sqft=3900,
    year_built=2019,
    amenities=["Sea view","Concierge service","Private infinity pool","Gymnasium","Terrace","24/7 security","Private garage"],
    features=["Two planted terraces","Three-sided glazing","Harbour panorama","Residents' pool","Secure parking"],
    latitude=18.9430, longitude=72.8230, images=["penthouse","rooftop","salon"],
    meta_title="The Harbour Light Apartment · Mumbai | Imperial Royal",
    meta_description="A three-bedroom corner residence on Marine Drive with two planted terraces and uninterrupted harbour views.")

add(slug="the-signature-land-parcel", title="The Signature Land Parcel",
    subtitle="A rare walled hillside parcel with consent for a principal residence.",
    description="A rare opportunity to create a legacy address from the ground up. This walled hillside parcel carries consent for a substantial principal residence and ancillary pavilions, with mature trees, a natural spring, a formed driveway and sweeping valley views already in place.",
    listing_type="buy", category="Land", price=89000000, location="Meghalaya Foothills", city="Guwahati",
    address="Signature Parcel, Meghalaya Foothills, Guwahati 781001", bedrooms=0, bathrooms=0, area_sqft=0,
    lot_sqft=142000, year_built=None, availability="reserved",
    amenities=["Landscaped gardens","24/7 security","River view"],
    features=["Consent for principal residence","Mature tree canopy","Natural spring","Formed driveway","Sweeping valley views"],
    latitude=26.1445, longitude=91.7362, images=["forest","garden","modern"],
    meta_title="The Signature Land Parcel · Guwahati | Imperial Royal",
    meta_description="A walled hillside land parcel near Guwahati with consent for a principal residence, mature trees and sweeping valley views.")

# --------------------------------------------------------------------------
TESTIMONIALS = [
    {"quote": "They understood that we were not buying a house, we were choosing where our family would gather for the next thirty years. Every detail was handled with extraordinary discretion.", "name": "Ananya Mehra", "role": "Private Client · Mumbai", "initials": "AM", "rating": 5, "sample": True},
    {"quote": "From the first private viewing to the final signature, the process felt less like a transaction and more like being looked after by people who genuinely know these homes.", "name": "Vikram Rathore", "role": "Private Client · Jaipur", "initials": "VR", "rating": 5, "sample": True},
    {"quote": "The dossier they prepared was the most considered document we received from any advisor. It answered questions we had not yet thought to ask.", "name": "Clara Whitfield", "role": "Private Client · London", "initials": "CW", "rating": 5, "sample": True},
    {"quote": "We were shown four residences in two days, each one exactly aligned with the brief. No wasted time, no pressure, just remarkable judgement.", "name": "Rohan Bansal", "role": "Private Client · New Delhi", "initials": "RB", "rating": 5, "sample": True},
    {"quote": "What stayed with us was the honesty. They told us plainly which property was right and which was not, even when the second was the more valuable introduction.", "name": "Sara D'Souza", "role": "Private Client · Goa", "initials": "SD", "rating": 5, "sample": True},
    {"quote": "The concierge team was still answering our questions six months after completion. That kind of stewardship is rare in any industry.", "name": "Arjun Khanna", "role": "Private Client · Bengaluru", "initials": "AK", "rating": 4, "sample": True},
    {"quote": "Beautifully presented, meticulously researched and completely confidential. We would not consider working with anyone else on a future acquisition.", "name": "Nadia Rahman", "role": "Private Client · Dubai", "initials": "NR", "rating": 5, "sample": True},
    {"quote": "They found us a home we had walked past for years without ever seeing. That is what a real eye for architecture and position looks like.", "name": "Devika Nair", "role": "Private Client · Kochi", "initials": "DN", "rating": 5, "sample": True},
]

SETTINGS = {
    "business_name": "Imperial Royal",
    "tagline": "Extraordinary Residences. Enduring Legacy.",
    "contact_email": "concierge@imperialroyal.com",
    "contact_phone": "+91 98764 00000",
    "whatsapp": "+91 98764 00000",
    "address": "The Imperial House, G.S. Road, Guwahati 781005, Assam, India",
    "hero_heading": "Where Exceptional Living Meets Timeless Elegance.",
    "hero_subheading": "Discover extraordinary residences, prestigious addresses and exceptional real estate opportunities.",
    "hero_image": IMG + "showcase-01.jpg",
    "footer_text": "A private collection of the world's most distinguished residences, curated with discretion and absolute integrity. Every address is considered, every introduction personal.",
    "footer_note": "Imperial Royal Real Estate. Crafted for a legacy.",
    "seo_title": "Imperial Royal | Extraordinary Residences & Prestigious Addresses",
    "seo_description": "Discover an exceptional collection of luxury residences, estates and penthouses. A private, discreet real estate experience.",
}

# --------------------------------------------------------------------------
def js(v):
    return json.dumps(v, ensure_ascii=False)

def sql_str(v):
    if v is None: return "null"
    return "'" + str(v).replace("'", "''") + "'"

def sql_array(v):
    return "array[" + ",".join(sql_str(x) for x in v) + "]::text[]"

def sql_num(v):
    if v is None: return "null"
    return str(v)

def showcase_id(i):
    return f"00000000-0000-4000-8000-{i:012d}"

def ts_property(i, p):
    keys = ["id","slug","title","subtitle","description","listing_type","category","status",
            "availability","price","currency","price_period","location","city","address","country",
            "bedrooms","bathrooms","area_sqft","lot_sqft","year_built","featured","amenities",
            "features","latitude","longitude","map_url","meta_title","meta_description",
            "created_at","updated_at","owner_id"]
    obj = {
        "id": showcase_id(i), "owner_id": None,
        "created_at": f"2026-01-{min(28, i+1):02d}T09:00:00.000Z",
        "updated_at": f"2026-02-{min(28, i+1):02d}T09:00:00.000Z",
        "map_url": None,
    }
    for k in keys:
        if k in p and k not in ("images",): obj[k] = p[k]
    lines = []
    for k in keys:
        lines.append(f"    {k}: {js(obj.get(k))},")
    return "  {\n" + "\n".join(lines) + "\n  }"

def ts_media():
    out = []
    for i, p in enumerate(P, 1):
        pid = showcase_id(i)
        for n, key in enumerate(p["images"]):
            asset = ASSETS[key]
            mid = f"10000000-0000-4000-8000-{i:04d}{n:08d}"
            spath = "showcase/{}/{:02d}.jpg".format(p["slug"], n + 1)
            alt = p["title"] + (" — principal view" if n == 0 else " — gallery view " + str(n + 1))
            out.append("  {\n" + "\n".join([
                f"    id: {js(mid)},",
                f"    property_id: {js(pid)},",
                "    kind: 'image',",
                f"    storage_path: {js(spath)},",
                f"    public_url: {js(asset)},",
                f"    position: {n},",
                f"    is_cover: {'true' if n == 0 else 'false'},",
                f"    alt_text: {js(alt)},",
                "    mime_type: 'image/jpeg',",
                "    file_size: 0,",
                "    created_at: '2026-01-01T09:00:00.000Z',",
            ]) + "\n  }")
    return out

def build_ts():
    props = ",\n".join(ts_property(i, p) for i, p in enumerate(P, 1))
    media = ",\n".join(ts_media())
    quotes = ",\n".join("  " + js(t) for t in TESTIMONIALS)
    settings = ",\n".join(f"  {k}: {js(v)}" for k, v in SETTINGS.items())
    return f'''/* ==================================================================
   IMPERIAL ROYAL — SHOWCASE CATALOGUE  (generated; do not hand-edit)
   Source of truth: scripts/generate-showcase.py

   This is an explicitly labelled DEMONSTRATION catalogue for an example
   client presentation. It is NOT real inventory and NOT a real database.
   It is shown only when the connected Supabase project has no published
   residences, and disappears automatically once real rows exist.

   Reviews below are SAMPLE references written for this demonstration.
   They must never be presented as genuine client endorsements, and no
   AggregateRating structured data is emitted for them.

   Set NEXT_PUBLIC_SHOWCASE=0 to disable showcase mode entirely.
================================================================== */
import type {{ PagedResult, Property, PropertyFilters, PropertyMedia, SiteSettings, Testimonial }} from '@/lib/types';
import {{ DEFAULT_SETTINGS }} from '@/lib/utils';

export const SHOWCASE_ENABLED = process.env.NEXT_PUBLIC_SHOWCASE !== '0';

export const SHOWCASE_PROPERTIES: Property[] = [
{props}
];

export const SHOWCASE_MEDIA: PropertyMedia[] = [
{media}
];

export const SHOWCASE_TESTIMONIALS: Testimonial[] = [
{quotes}
];

export const SHOWCASE_SETTINGS: Partial<SiteSettings> = {{
{settings}
}};

const IDS = new Set(SHOWCASE_PROPERTIES.map(p => p.id));
export function isShowcaseId(id: string): boolean {{ return IDS.has(id); }}
export function isShowcaseProperty(p: Property | null): boolean {{ return !!p && IDS.has(p.id); }}
export function findShowcaseBySlug(slug: string): Property | null {{
  return SHOWCASE_PROPERTIES.find(p => p.slug === slug && p.status === 'published') ?? null;
}}
export function showcaseMediaFor(ids: string[]): PropertyMedia[] {{
  if (!SHOWCASE_ENABLED) return [];
  const set = new Set(ids);
  return SHOWCASE_MEDIA.filter(m => set.has(m.property_id));
}}
export function showcaseMediaForProperty(id: string): PropertyMedia[] {{
  return showcaseMediaFor([id]);
}}
export function showcaseRelated(current: Property, limit = 3): Property[] {{
  const sameCity = SHOWCASE_PROPERTIES.filter(p => p.id !== current.id && p.city === current.city);
  const sameCategory = SHOWCASE_PROPERTIES.filter(p => p.id !== current.id && p.category === current.category);
  const seen = new Set<string>();
  const out: Property[] = [];
  for (const p of [...sameCity, ...sameCategory, ...SHOWCASE_PROPERTIES]) {{
    if (p.id === current.id || seen.has(p.id)) continue;
    seen.add(p.id); out.push(p);
    if (out.length >= limit) break;
  }}
  return out;
}}

/** Apply the same filter/sort/pagination contract as PostgREST, in memory. */
export function showcasePaged(filters: PropertyFilters): PagedResult<Property> {{
  const perPage = Math.min(48, Math.max(1, filters.perPage ?? 9));
  const page = Math.max(1, filters.page ?? 1);
  const q = (filters.q ?? '').trim().toLowerCase();
  let items = SHOWCASE_PROPERTIES.filter(p => p.status === 'published');
  if (filters.listingType && filters.listingType !== 'all') items = items.filter(p => p.listing_type === filters.listingType);
  if (filters.category) items = items.filter(p => p.category === filters.category);
  if (filters.availability && filters.availability !== 'all') items = items.filter(p => p.availability === filters.availability);
  if (filters.featured) items = items.filter(p => p.featured);
  if (filters.location) {{
    const l = filters.location.toLowerCase();
    items = items.filter(p => p.city.toLowerCase().includes(l) || p.location.toLowerCase().includes(l));
  }}
  if (filters.minPrice) items = items.filter(p => Number(p.price) >= filters.minPrice!);
  if (filters.maxPrice) items = items.filter(p => Number(p.price) <= filters.maxPrice!);
  if (filters.bedrooms) items = items.filter(p => p.bedrooms >= filters.bedrooms!);
  if (filters.bathrooms) items = items.filter(p => p.bathrooms >= filters.bathrooms!);
  if (filters.minArea) items = items.filter(p => Number(p.area_sqft) >= filters.minArea!);
  if (q) items = items.filter(p =>
    [p.title, p.city, p.location, p.category, p.description ?? '', p.subtitle ?? '']
      .join(' ').toLowerCase().includes(q));
  switch (filters.sort) {{
    case 'price-asc': items = [...items].sort((a,b) => Number(a.price) - Number(b.price)); break;
    case 'price-desc': items = [...items].sort((a,b) => Number(b.price) - Number(a.price)); break;
    case 'area-desc': items = [...items].sort((a,b) => Number(b.area_sqft) - Number(a.area_sqft)); break;
    case 'title': items = [...items].sort((a,b) => a.title.localeCompare(b.title)); break;
    default: items = [...items].sort((a,b) => Number(b.featured) - Number(a.featured) || b.created_at.localeCompare(a.created_at));
  }}
  const total = items.length;
  return {{ items: items.slice((page-1)*perPage, page*perPage), total, page, perPage,
    pages: Math.max(1, Math.ceil(total / perPage)) }};
}}

export function showcaseCities(): string[] {{
  return Array.from(new Set(SHOWCASE_PROPERTIES.filter(p => p.status === 'published').map(p => p.city))).sort();
}}

export function mergeShowcaseSettings(settings: SiteSettings): SiteSettings {{
  if (!SHOWCASE_ENABLED) return settings;
  // Real owner-published values always win. Only untouched factory defaults
  // are replaced by the showcase's presentation copy.
  const merged: SiteSettings = {{ ...DEFAULT_SETTINGS, ...settings }};
  for (const [key, value] of Object.entries(SHOWCASE_SETTINGS)) {{
    const k = key as keyof SiteSettings;
    const current = (merged as unknown as Record<string, unknown>)[k];
    const fallback = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k];
    if (current === fallback || current === null || current === '') {{
      (merged as unknown as Record<string, unknown>)[k] = value;
    }}
  }}
  merged.testimonials = (settings.testimonials?.length ? settings.testimonials : SHOWCASE_TESTIMONIALS);
  return merged;
}}

export const SHOWCASE_NOTE = 'Showcase catalogue — illustrative residences and sample references for this demonstration.';
'''

# --------------------------------------------------------------------------
def build_sql():
    schema = (ROOT / "supabase" / "schema.sql").read_text()
    storage = (ROOT / "supabase" / "storage.sql").read_text()

    prelude = """-- ==================================================================
-- IMPERIAL ROYAL — SHOWCASE SETUP   (generated; do not hand-edit)
-- Source of truth: scripts/generate-showcase.py
--
-- ONE-PASTE SETUP for the client's Supabase project.
-- Run this ONCE in Supabase Dashboard > SQL Editor > New query > Run.
-- Safe to re-run: every statement is guarded or idempotent.
--
-- WHAT THIS FIXES
--   The project was created for a DIFFERENT application ("Aurum Estates").
--   Its `properties`, `property_media`, `inquiries` and `site_settings`
--   tables have a different shape. `create table if not exists` would
--   silently KEEP that shape, so section 0 verifies EVERY column the
--   schema, policies and seed need before deciding to rebuild.
--
-- DATA SAFETY
--   Before replacing anything, the existing rows of every affected table
--   are COPIED to public.imperial_legacy_* tables. Nothing is deleted
--   without a backup. The backup is created only once.
--
-- CONTENT
--   20 showcase residences, 60 gallery images and 8 sample references with
--   star ratings are inserted. These are DEMONSTRATION records for a client
--   example site, not real inventory and not genuine client endorsements.
--   Remove them from the Owner Studio before using this project for real.
--
-- ALSO INSTALLED: RLS policies, inquiry trigger, storage buckets, and
--   owner provisioning (the first auth user becomes the verified owner).
-- ==================================================================

-- ---------------------------------------------------------------- 0. guard
-- A half-migrated project is worse than an empty one. Check ALL required
-- columns of all four content tables, not just one sentinel column.
do $guard$
declare
  mismatched boolean := false;
  tbl text;
begin
  with needed(t, cols) as (
    values
      ('properties', array[
        'id','owner_id','slug','title','subtitle','description','listing_type',
        'category','status','availability','price','currency','price_period',
        'location','city','address','country','bedrooms','bathrooms','area_sqft',
        'lot_sqft','year_built','featured','amenities','features','latitude',
        'longitude','map_url','meta_title','meta_description','created_at','updated_at']),
      ('property_media', array[
        'id','property_id','kind','storage_path','public_url','position',
        'is_cover','alt_text','mime_type','file_size','created_at']),
      ('inquiries', array[
        'id','property_id','name','email','phone','message','status','source',
        'created_at','updated_at']),
      ('site_settings', array[
        'id','business_name','tagline','logo_url','favicon_url','contact_email',
        'contact_phone','whatsapp','address','hero_heading','hero_subheading',
        'hero_image','social','footer_text','footer_note','seo_title',
        'seo_description','testimonials','theme','updated_at'])
  )
  select coalesce(bool_or(
    to_regclass('public.' || n.t) is not null
    and exists (
      select 1 from unnest(n.cols) as c(col)
      where not exists (
        select 1 from information_schema.columns ic
        where ic.table_schema = 'public'
          and ic.table_name = n.t
          and ic.column_name = c.col
      )
    )
  ), false) into mismatched
  from needed n;

  if mismatched then
    -- Keep a copy of the previous application's data, once only.
    if to_regclass('public.imperial_legacy_backup') is null then
      for tbl in select unnest(array['properties','property_media','inquiries','site_settings','profiles'])
      loop
        if to_regclass('public.' || tbl) is not null then
          execute format('create table if not exists public.%I as select * from public.%I',
                         'imperial_legacy_' || tbl, tbl);
        end if;
      end loop;
      execute 'create table public.imperial_legacy_backup (created_at timestamptz not null default now())';
      execute 'insert into public.imperial_legacy_backup default values';
    end if;
    -- Children first. `profiles` is kept and aligned below so the auth.users
    -- trigger and public.is_owner() never lose their target table.
    execute 'drop table if exists public.property_media cascade';
    execute 'drop table if exists public.inquiries cascade';
    execute 'drop table if exists public.properties cascade';
    execute 'drop table if exists public.site_settings cascade';
    raise notice 'Imperial Royal: legacy schema detected. Old rows backed up to imperial_legacy_* and content tables rebuilt.';
  end if;

  -- profiles is referenced by is_owner() and the auth.users trigger. Only a
  -- table with no uuid `id` must be rebuilt; otherwise align it in place.
  if to_regclass('public.profiles') is not null and (
       not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'profiles' and column_name = 'id')
       or exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles'
                    and column_name = 'id' and data_type <> 'uuid')) then
    execute 'drop table if exists public.profiles cascade';
    execute $ddl$create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      email text not null default '', full_name text,
      is_owner boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())$ddl$;
  end if;

  if to_regclass('public.profiles') is not null then
    alter table public.profiles add column if not exists email text;
    alter table public.profiles add column if not exists full_name text;
    alter table public.profiles add column if not exists is_owner boolean not null default false;
    alter table public.profiles add column if not exists created_at timestamptz not null default now();
    alter table public.profiles add column if not exists updated_at timestamptz not null default now();
    create unique index if not exists imperial_profiles_id_key on public.profiles (id);
    -- Unknown NOT NULL columns without defaults would break handle_new_user().
    for tbl in
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and is_nullable = 'NO' and column_default is null
        and column_name not in ('id','email','is_owner','created_at','updated_at')
    loop
      execute format('alter table public.profiles alter column %I drop not null', tbl);
    end loop;
  end if;
end $guard$;

-- ------------------------------------------------- 0b. privilege repair
-- An interrupted earlier run may have enabled RLS without reaching the
-- GRANT statements. Restore the minimum public privileges whenever the
-- tables exist, so the site is never locked out by a partial migration.
do $grants$
begin
  execute 'grant usage on schema public to anon, authenticated';
  if to_regclass('public.properties') is not null then
    execute 'grant select on public.properties to anon, authenticated';
    execute 'grant all on public.properties to authenticated';
  end if;
  if to_regclass('public.property_media') is not null then
    execute 'grant select on public.property_media to anon, authenticated';
    execute 'grant all on public.property_media to authenticated';
  end if;
  if to_regclass('public.site_settings') is not null then
    execute 'grant select on public.site_settings to anon, authenticated';
    execute 'grant all on public.site_settings to authenticated';
  end if;
  if to_regclass('public.inquiries') is not null then
    execute 'revoke all on public.inquiries from anon';
    execute 'grant insert on public.inquiries to anon';
    execute 'grant all on public.inquiries to authenticated';
  end if;
  if to_regclass('public.profiles') is not null then
    -- A different application's script may have granted anon access to
    -- profiles.is_owner. Close that hole on every run.
    execute 'revoke all on public.profiles from anon';
    execute 'grant select on public.profiles to authenticated';
  end if;
exception when others then
  raise notice 'Imperial Royal: privilege repair deferred (%)', sqlerrm;
end $grants$;

"""

    seed = ["-- ---------------------------------------------------------------- 9. SEED\n"]
    cols = ["slug","title","subtitle","description","listing_type","category","status","availability",
            "price","currency","price_period","location","city","address","country","bedrooms",
            "bathrooms","area_sqft","lot_sqft","year_built","featured","amenities","features",
            "latitude","longitude","map_url","meta_title","meta_description"]
    values = []
    for p in P:
        row = []
        for c in cols:
            v = p.get(c)
            if c in ("amenities", "features"): row.append(sql_array(v or []))
            elif isinstance(v, bool): row.append("true" if v else "false")
            elif isinstance(v, (int, float)): row.append(sql_num(v))
            else: row.append(sql_str(v))
        values.append("    (" + ",\n     ".join(row) + ")")
    seed.append("insert into public.properties (\n  " + ",\n  ".join(cols) + "\n) values\n")
    seed.append(",\n".join(values))
    seed.append("\non conflict (slug) do update set\n  " + ",\n  ".join(
        f"{c} = excluded.{c}" for c in cols if c != "slug") + ";\n\n")

    # Media: remove only our own seeded rows, then insert fresh.
    seed.append("""-- Gallery images. Only showcase-owned rows are refreshed on re-run.
delete from public.property_media where storage_path like 'showcase/%';

insert into public.property_media
  (property_id, kind, storage_path, public_url, position, is_cover, alt_text, mime_type, file_size)
select p.id, 'image', m.path, m.url, m.pos, m.cover, m.alt, 'image/jpeg', 0
from (values
""")
    tv = []
    for i, p in enumerate(P, 1):
        for n, key in enumerate(p["images"]):
            asset = ASSETS[key]
            alt = p["title"] + (" — principal view" if n == 0 else f" — gallery view {n+1}")
            tv.append("    (" + ", ".join([
                sql_str(p["slug"]), sql_str(f"showcase/{p['slug']}/{n+1:02d}.jpg"),
                sql_str(asset), str(n), "true" if n == 0 else "false", sql_str(alt),
            ]) + ")")
    seed.append(",\n".join(tv))
    seed.append(""") as m(slug, path, url, pos, cover, alt)
join public.properties p on p.slug = m.slug;

""")

    seed.append("-- Site settings: branding, hero artwork and SAMPLE references with star ratings.\n")
    seed.append("update public.site_settings set\n  " + ",\n  ".join(
        f"{k} = {sql_str(v)}" for k, v in SETTINGS.items()) + ",\n")
    seed.append("  testimonials = " + sql_str(json.dumps(TESTIMONIALS, ensure_ascii=False)) + "::jsonb,\n")
    seed.append("  social = '{}'::jsonb,\n  theme = '{\"accent\":\"#C6A45A\",\"density\":\"comfortable\"}'::jsonb\nwhere id = 1;\n\n")

    seed.append("""-- ------------------------------------------------------------- 10. OWNER
-- Ensure every Auth user has a profile row before provisioning.
insert into public.profiles (id, email, is_owner)
select u.id, coalesce(u.email, ''), false from auth.users u
on conflict (id) do nothing;

-- The first project user becomes the verified owner. If you have several
-- accounts, replace the WHERE clause with: where lower(email) = lower('you@example.com')
update public.profiles p set is_owner = true
where p.id = (select u.id from auth.users u order by u.created_at asc limit 1);

-- ------------------------------------------------------------- 11. VERIFY
do $$
declare
  props int; media int; refs int; owners int;
begin
  select count(*) into props from public.properties where status = 'published';
  select count(*) into media from public.property_media;
  select jsonb_array_length(testimonials) into refs from public.site_settings where id = 1;
  select count(*) into owners from public.profiles where is_owner;
  raise notice 'IMPERIAL ROYAL SETUP COMPLETE — published properties: %, gallery images: %, sample references: %, verified owners: %', props, media, refs, owners;
  if props < 20 then raise warning 'Fewer than 20 published properties were detected.'; end if;
  if owners = 0 then raise warning 'No owner was provisioned. Check that an Auth user exists, then re-run this script.'; end if;
end $$;
""")

    return prelude + schema + "\n-- ---------------------------------------------------------------- 8. STORAGE\n" + storage + "\n" + "".join(seed)

# --------------------------------------------------------------------------
(ROOT / "lib" / "showcase.ts").write_text(build_ts())
(ROOT / "supabase" / "showcase-setup.sql").write_text(build_sql())
(ROOT / "public" / "sql" / "showcase-setup.sql").write_text(build_sql())
print(f"Generated lib/showcase.ts, supabase/showcase-setup.sql, public/sql/showcase-setup.sql")
print(f"  {len(P)} properties, {sum(len(p['images']) for p in P)} media rows, {len(TESTIMONIALS)} sample references")
