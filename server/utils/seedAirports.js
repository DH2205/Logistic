// Seed script to populate airports in the database
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = process.env.DB_FILE || './data/db.json';

function readDb() {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading database:', error);
  }
  return {
    users: [],
    products: [],
    carts: [],
    orders: [],
    locations: []
  };
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Simple database helper for seeding
const db = {
  get: (collection) => {
    const data = readDb();
    return {
      value: () => data[collection] || [],
      push: (item) => {
        if (!data[collection]) {
          data[collection] = [];
        }
        data[collection].push(item);
        writeDb(data);
        return {
          write: () => writeDb(data),
          value: () => data[collection]
        };
      },
      filter: (query) => ({
        value: () => {
          const items = data[collection] || [];
          if (typeof query === 'function') {
            return items.filter(query);
          }
          return items.filter(item => {
            return Object.keys(query).every(key => item[key] === query[key]);
          });
        }
      })
    };
  }
};

// Major airports worldwide with coordinates
const airports = [
  // North America
  { name: 'Hartsfield-Jackson Atlanta International Airport', type: 'airport', latitude: 33.6407, longitude: -84.4277, city: 'Atlanta', country: 'United States', address: '6000 N Terminal Pkwy, Atlanta, GA 30320' },
  { name: 'Los Angeles International Airport', type: 'airport', latitude: 33.9425, longitude: -118.4081, city: 'Los Angeles', country: 'United States', address: '1 World Way, Los Angeles, CA 90045' },
  { name: 'Chicago O\'Hare International Airport', type: 'airport', latitude: 41.9786, longitude: -87.9048, city: 'Chicago', country: 'United States', address: '10000 W O\'Hare Ave, Chicago, IL 60666' },
  { name: 'Dallas/Fort Worth International Airport', type: 'airport', latitude: 32.8998, longitude: -97.0403, city: 'Dallas', country: 'United States', address: '2400 Aviation Dr, DFW Airport, TX 75261' },
  { name: 'Denver International Airport', type: 'airport', latitude: 39.8561, longitude: -104.6737, city: 'Denver', country: 'United States', address: '8500 Peña Blvd, Denver, CO 80249' },
  { name: 'John F. Kennedy International Airport', type: 'airport', latitude: 40.6413, longitude: -73.7781, city: 'New York', country: 'United States', address: 'Queens, NY 11430' },
  { name: 'San Francisco International Airport', type: 'airport', latitude: 37.6213, longitude: -122.3790, city: 'San Francisco', country: 'United States', address: 'San Francisco, CA 94128' },
  { name: 'Seattle-Tacoma International Airport', type: 'airport', latitude: 47.4502, longitude: -122.3088, city: 'Seattle', country: 'United States', address: '17801 International Blvd, Seattle, WA 98158' },
  { name: 'Las Vegas McCarran International Airport', type: 'airport', latitude: 36.0840, longitude: -115.1537, city: 'Las Vegas', country: 'United States', address: '5757 Wayne Newton Blvd, Las Vegas, NV 89119' },
  { name: 'Miami International Airport', type: 'airport', latitude: 25.7959, longitude: -80.2870, city: 'Miami', country: 'United States', address: '2100 NW 42nd Ave, Miami, FL 33126' },
  { name: 'Toronto Pearson International Airport', type: 'airport', latitude: 43.6772, longitude: -79.6306, city: 'Toronto', country: 'Canada', address: '6301 Silver Dart Dr, Mississauga, ON L5P 1B2' },
  { name: 'Vancouver International Airport', type: 'airport', latitude: 49.1947, longitude: -123.1792, city: 'Vancouver', country: 'Canada', address: '3211 Grant McConachie Way, Richmond, BC V7B 1M7' },
  { name: 'Mexico City International Airport', type: 'airport', latitude: 19.4363, longitude: -99.0721, city: 'Mexico City', country: 'Mexico', address: 'Av. Capitán Carlos León s/n, Peñón de los Baños, Venustiano Carranza' },

  // Europe
  { name: 'London Heathrow Airport', type: 'airport', latitude: 51.4700, longitude: -0.4543, city: 'London', country: 'United Kingdom', address: 'Longford TW6' },
  { name: 'Paris Charles de Gaulle Airport', type: 'airport', latitude: 49.0097, longitude: 2.5479, city: 'Paris', country: 'France', address: '95700 Roissy-en-France' },
  { name: 'Amsterdam Airport Schiphol', type: 'airport', latitude: 52.3105, longitude: 4.7683, city: 'Amsterdam', country: 'Netherlands', address: 'Evert van de Beekstraat 202, 1118 CP Schiphol' },
  { name: 'Frankfurt Airport', type: 'airport', latitude: 50.0379, longitude: 8.5622, city: 'Frankfurt', country: 'Germany', address: '60547 Frankfurt am Main' },
  { name: 'Madrid-Barajas Airport', type: 'airport', latitude: 40.4839, longitude: -3.5680, city: 'Madrid', country: 'Spain', address: 'Av de la Hispanidad, s/n, 28042 Madrid' },
  { name: 'Rome Fiumicino Airport', type: 'airport', latitude: 41.8003, longitude: 12.2389, city: 'Rome', country: 'Italy', address: 'Via dell\'Aeroporto di Fiumicino, 320, 00054 Fiumicino RM' },
  { name: 'Munich Airport', type: 'airport', latitude: 48.3538, longitude: 11.7861, city: 'Munich', country: 'Germany', address: 'Nordallee 25, 85356 München-Flughafen' },
  { name: 'Istanbul Airport', type: 'airport', latitude: 41.2753, longitude: 28.7519, city: 'Istanbul', country: 'Turkey', address: 'Tayakadın, Terminal Cad No:1, 34283 Arnavutköy/İstanbul' },
  { name: 'Zurich Airport', type: 'airport', latitude: 47.4647, longitude: 8.5492, city: 'Zurich', country: 'Switzerland', address: '8058 Zürich-Flughafen' },
  { name: 'Vienna International Airport', type: 'airport', latitude: 48.1103, longitude: 16.5697, city: 'Vienna', country: 'Austria', address: 'Wien-Flughafen, 1300 Schwechat' },
  { name: 'Copenhagen Airport', type: 'airport', latitude: 55.6180, longitude: 12.6500, city: 'Copenhagen', country: 'Denmark', address: 'Lufthavnsboulevarden 6, 2770 Kastrup' },
  { name: 'Stockholm Arlanda Airport', type: 'airport', latitude: 59.6519, longitude: 17.9186, city: 'Stockholm', country: 'Sweden', address: '190 45 Stockholm-Arlanda' },
  { name: 'Oslo Gardermoen Airport', type: 'airport', latitude: 60.1939, longitude: 11.1004, city: 'Oslo', country: 'Norway', address: 'Edvard Munchs veg, 2061 Gardermoen' },
  { name: 'Helsinki-Vantaa Airport', type: 'airport', latitude: 60.3172, longitude: 24.9633, city: 'Helsinki', country: 'Finland', address: 'Lentäjäntie 3, 01530 Vantaa' },
  { name: 'Dublin Airport', type: 'airport', latitude: 53.4264, longitude: -6.2499, city: 'Dublin', country: 'Ireland', address: 'Dublin Airport, Co. Dublin' },
  { name: 'Brussels Airport', type: 'airport', latitude: 50.9014, longitude: 4.4844, city: 'Brussels', country: 'Belgium', address: 'Leopoldlaan, 1930 Zaventem' },
  { name: 'Warsaw Chopin Airport', type: 'airport', latitude: 52.1657, longitude: 20.9671, city: 'Warsaw', country: 'Poland', address: 'Żwirki i Wigury 1, 00-906 Warszawa' },
  { name: 'Prague Václav Havel Airport', type: 'airport', latitude: 50.1009, longitude: 14.2633, city: 'Prague', country: 'Czech Republic', address: 'Aviatická, 161 00 Praha 6' },

  // Asia
  { name: 'Beijing Capital International Airport', type: 'airport', latitude: 40.0799, longitude: 116.6031, city: 'Beijing', country: 'China', address: 'Shunyi District, Beijing' },
  { name: 'Shanghai Pudong International Airport', type: 'airport', latitude: 31.1443, longitude: 121.8083, city: 'Shanghai', country: 'China', address: 'Pudong, Shanghai' },
  { name: 'Guangzhou Baiyun International Airport', type: 'airport', latitude: 23.3924, longitude: 113.2988, city: 'Guangzhou', country: 'China', address: 'Baiyun District, Guangzhou' },
  { name: 'Hong Kong International Airport', type: 'airport', latitude: 22.3080, longitude: 113.9185, city: 'Hong Kong', country: 'China', address: 'Chek Lap Kok, Hong Kong' },
  { name: 'Tokyo Haneda Airport', type: 'airport', latitude: 35.5494, longitude: 139.7798, city: 'Tokyo', country: 'Japan', address: 'Ōta City, Tokyo' },
  { name: 'Tokyo Narita International Airport', type: 'airport', latitude: 35.7720, longitude: 140.3929, city: 'Tokyo', country: 'Japan', address: 'Narita, Chiba' },
  { name: 'Seoul Incheon International Airport', type: 'airport', latitude: 37.4602, longitude: 126.4407, city: 'Seoul', country: 'South Korea', address: '272 Gonghang-ro, Jung-gu, Incheon' },
  { name: 'Singapore Changi Airport', type: 'airport', latitude: 1.3644, longitude: 103.9915, city: 'Singapore', country: 'Singapore', address: 'Airport Blvd., Singapore' },
  { name: 'Bangkok Suvarnabhumi Airport', type: 'airport', latitude: 13.6900, longitude: 100.7501, city: 'Bangkok', country: 'Thailand', address: '999, Nong Prue, Bang Phli District, Samut Prakan' },
  { name: 'Kuala Lumpur International Airport', type: 'airport', latitude: 2.7456, longitude: 101.7099, city: 'Kuala Lumpur', country: 'Malaysia', address: '64000 Sepang, Selangor' },
  { name: 'Jakarta Soekarno-Hatta International Airport', type: 'airport', latitude: -6.1256, longitude: 106.6558, city: 'Jakarta', country: 'Indonesia', address: 'Tangerang, Banten' },
  { name: 'Manila Ninoy Aquino International Airport', type: 'airport', latitude: 14.5086, longitude: 121.0196, city: 'Manila', country: 'Philippines', address: 'Pasay, Metro Manila' },
  { name: 'Ho Chi Minh City Tan Son Nhat International Airport', type: 'airport', latitude: 10.8185, longitude: 106.6520, city: 'Ho Chi Minh City', country: 'Vietnam', address: 'Trường Sơn, Phường 2, Tân Bình' },
  { name: 'Hanoi Noi Bai International Airport', type: 'airport', latitude: 21.2212, longitude: 105.8072, city: 'Hanoi', country: 'Vietnam', address: 'Phú Minh, Sóc Sơn, Hà Nội' },
  { name: 'Dubai International Airport', type: 'airport', latitude: 25.2532, longitude: 55.3657, city: 'Dubai', country: 'United Arab Emirates', address: 'Dubai' },
  { name: 'Abu Dhabi International Airport', type: 'airport', latitude: 24.4330, longitude: 54.6511, city: 'Abu Dhabi', country: 'United Arab Emirates', address: 'Abu Dhabi' },
  { name: 'Doha Hamad International Airport', type: 'airport', latitude: 25.2611, longitude: 51.5651, city: 'Doha', country: 'Qatar', address: 'Doha' },
  { name: 'Riyadh King Khalid International Airport', type: 'airport', latitude: 24.9576, longitude: 46.6988, city: 'Riyadh', country: 'Saudi Arabia', address: 'Riyadh' },
  { name: 'Jeddah King Abdulaziz International Airport', type: 'airport', latitude: 21.6796, longitude: 39.1565, city: 'Jeddah', country: 'Saudi Arabia', address: 'Jeddah' },
  { name: 'Istanbul Sabiha Gökçen International Airport', type: 'airport', latitude: 40.8986, longitude: 29.3092, city: 'Istanbul', country: 'Turkey', address: 'Kurtköy, 34912 Pendik/İstanbul' },
  { name: 'Mumbai Chhatrapati Shivaji Maharaj International Airport', type: 'airport', latitude: 19.0896, longitude: 72.8656, city: 'Mumbai', country: 'India', address: 'Mumbai, Maharashtra' },
  { name: 'Delhi Indira Gandhi International Airport', type: 'airport', latitude: 28.5562, longitude: 77.1000, city: 'Delhi', country: 'India', address: 'New Delhi, Delhi' },
  { name: 'Bangalore Kempegowda International Airport', type: 'airport', latitude: 13.1986, longitude: 77.7066, city: 'Bangalore', country: 'India', address: 'Devanahalli, Karnataka' },
  { name: 'Chennai International Airport', type: 'airport', latitude: 12.9941, longitude: 80.1709, city: 'Chennai', country: 'India', address: 'Meenambakkam, Chennai, Tamil Nadu' },
  { name: 'Kolkata Netaji Subhas Chandra Bose International Airport', type: 'airport', latitude: 22.6547, longitude: 88.4467, city: 'Kolkata', country: 'India', address: 'Kolkata, West Bengal' },
  { name: 'Hyderabad Rajiv Gandhi International Airport', type: 'airport', latitude: 17.2403, longitude: 78.4294, city: 'Hyderabad', country: 'India', address: 'Shamshabad, Telangana' },
  { name: 'Karachi Jinnah International Airport', type: 'airport', latitude: 24.9065, longitude: 67.1607, city: 'Karachi', country: 'Pakistan', address: 'Karachi' },
  { name: 'Islamabad International Airport', type: 'airport', latitude: 33.6167, longitude: 73.0992, city: 'Islamabad', country: 'Pakistan', address: 'Islamabad' },
  { name: 'Dhaka Hazrat Shahjalal International Airport', type: 'airport', latitude: 23.8433, longitude: 90.3978, city: 'Dhaka', country: 'Bangladesh', address: 'Kurmitola, Dhaka' },
  { name: 'Colombo Bandaranaike International Airport', type: 'airport', latitude: 7.1806, longitude: 79.8842, city: 'Colombo', country: 'Sri Lanka', address: 'Katunayake' },

  // Oceania
  { name: 'Sydney Kingsford Smith Airport', type: 'airport', latitude: -33.9399, longitude: 151.1753, city: 'Sydney', country: 'Australia', address: 'Sydney NSW 2020' },
  { name: 'Melbourne Airport', type: 'airport', latitude: -37.6733, longitude: 144.8433, city: 'Melbourne', country: 'Australia', address: 'Melbourne Airport VIC 3045' },
  { name: 'Brisbane Airport', type: 'airport', latitude: -27.3842, longitude: 153.1171, city: 'Brisbane', country: 'Australia', address: 'Brisbane Airport QLD 4008' },
  { name: 'Auckland Airport', type: 'airport', latitude: -37.0082, longitude: 174.7850, city: 'Auckland', country: 'New Zealand', address: 'Auckland Airport, Auckland' },
  { name: 'Wellington Airport', type: 'airport', latitude: -41.3272, longitude: 174.8053, city: 'Wellington', country: 'New Zealand', address: 'Wellington Airport, Wellington' },

  // South America
  { name: 'São Paulo-Guarulhos International Airport', type: 'airport', latitude: -23.4321, longitude: -46.4695, city: 'São Paulo', country: 'Brazil', address: 'Guarulhos, SP' },
  { name: 'Rio de Janeiro-Galeão International Airport', type: 'airport', latitude: -22.8089, longitude: -43.2436, city: 'Rio de Janeiro', country: 'Brazil', address: 'Rio de Janeiro, RJ' },
  { name: 'Buenos Aires Ezeiza International Airport', type: 'airport', latitude: -34.8222, longitude: -58.5358, city: 'Buenos Aires', country: 'Argentina', address: 'Autopista Tte. Gral. Ricchieri Km 33.5, B1802 Ezeiza' },
  { name: 'Bogotá El Dorado International Airport', type: 'airport', latitude: 4.7016, longitude: -74.1469, city: 'Bogotá', country: 'Colombia', address: 'Bogotá' },
  { name: 'Lima Jorge Chávez International Airport', type: 'airport', latitude: -12.0219, longitude: -77.1143, city: 'Lima', country: 'Peru', address: 'Callao' },
  { name: 'Santiago Arturo Merino Benítez International Airport', type: 'airport', latitude: -33.3930, longitude: -70.7858, city: 'Santiago', country: 'Chile', address: 'Santiago' },

  // Africa
  { name: 'Johannesburg O.R. Tambo International Airport', type: 'airport', latitude: -26.1367, longitude: 28.2411, city: 'Johannesburg', country: 'South Africa', address: 'Kempton Park, Johannesburg' },
  { name: 'Cape Town International Airport', type: 'airport', latitude: -33.9695, longitude: 18.5972, city: 'Cape Town', country: 'South Africa', address: 'Cape Town' },
  { name: 'Cairo International Airport', type: 'airport', latitude: 30.1219, longitude: 31.4056, city: 'Cairo', country: 'Egypt', address: 'Cairo' },
  { name: 'Casablanca Mohammed V International Airport', type: 'airport', latitude: 33.3675, longitude: -7.5899, city: 'Casablanca', country: 'Morocco', address: 'Casablanca' },
  { name: 'Lagos Murtala Muhammed International Airport', type: 'airport', latitude: 6.5774, longitude: 3.3211, city: 'Lagos', country: 'Nigeria', address: 'Lagos' },
  { name: 'Nairobi Jomo Kenyatta International Airport', type: 'airport', latitude: -1.3192, longitude: 36.9275, city: 'Nairobi', country: 'Kenya', address: 'Nairobi' },
  { name: 'Addis Ababa Bole International Airport', type: 'airport', latitude: 8.9779, longitude: 38.7993, city: 'Addis Ababa', country: 'Ethiopia', address: 'Addis Ababa' },
];

function seedAirports() {
  try {
    const existingLocations = db.get('locations').value() || [];
    const existingAirports = existingLocations.filter(loc => loc.type === 'airport');
    
    // Only add airports if they don't already exist
    const airportsToAdd = airports.filter(airport => {
      return !existingAirports.some(existing => 
        existing.name === airport.name || 
        (existing.latitude === airport.latitude && existing.longitude === airport.longitude)
      );
    });

    if (airportsToAdd.length === 0) {
      console.log('All airports already exist in database');
      return { added: 0, total: airports.length };
    }

    airportsToAdd.forEach(airport => {
      const location = {
        id: uuidv4(),
        ...airport,
        description: `International airport in ${airport.city}, ${airport.country}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.get('locations').push(location).write();
    });

    console.log(`Successfully added ${airportsToAdd.length} airports to database`);
    return { added: airportsToAdd.length, total: airports.length };
  } catch (error) {
    console.error('Error seeding airports:', error);
    throw error;
  }
}

module.exports = { seedAirports, airports };
