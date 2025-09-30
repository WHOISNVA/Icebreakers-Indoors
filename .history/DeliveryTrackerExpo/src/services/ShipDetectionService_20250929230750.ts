import * as Location from 'expo-location';

const CRUISE_SHIP_AREAS = [
  // === NORTH AMERICA - ATLANTIC ===
  { name: 'Miami Port', lat: 25.7612, lng: -80.1923, radius: 2000 },
  { name: 'Port Canaveral', lat: 28.4108, lng: -80.6036, radius: 2000 },
  { name: 'Fort Lauderdale', lat: 26.1224, lng: -80.1373, radius: 2000 },
  { name: 'Jacksonville Port', lat: 30.3322, lng: -81.6557, radius: 2000 },
  { name: 'Charleston Port', lat: 32.7765, lng: -79.9311, radius: 2000 },
  { name: 'Baltimore Port', lat: 39.2904, lng: -76.6122, radius: 2000 },
  { name: 'New York Port', lat: 40.7589, lng: -73.9851, radius: 2000 },
  { name: 'Boston Port', lat: 42.3601, lng: -71.0589, radius: 2000 },
  { name: 'Portland Maine', lat: 43.6591, lng: -70.2568, radius: 2000 },
  
  // === NORTH AMERICA - GULF ===
  { name: 'Galveston Port', lat: 29.3013, lng: -94.7977, radius: 2000 },
  { name: 'New Orleans Port', lat: 29.9511, lng: -90.0715, radius: 2000 },
  { name: 'Mobile Port', lat: 30.6944, lng: -88.0399, radius: 2000 },
  { name: 'Tampa Port', lat: 27.9506, lng: -82.4572, radius: 2000 },
  
  // === NORTH AMERICA - PACIFIC ===
  { name: 'San Diego Port', lat: 32.7157, lng: -117.1611, radius: 2000 },
  { name: 'Los Angeles Port', lat: 33.7701, lng: -118.1937, radius: 2000 },
  { name: 'Long Beach Port', lat: 33.7701, lng: -118.1937, radius: 2000 },
  { name: 'San Francisco Port', lat: 37.7749, lng: -122.4194, radius: 2000 },
  { name: 'Seattle Port', lat: 47.6062, lng: -122.3321, radius: 2000 },
  { name: 'Vancouver Port', lat: 49.2827, lng: -123.1207, radius: 2000 },
  
  // === ALASKA & PACIFIC NORTHWEST ===
  { name: 'Anchorage Port', lat: 61.2181, lng: -149.9003, radius: 2000 },
  { name: 'Whittier Port', lat: 60.7741, lng: -148.6858, radius: 2000 },
  { name: 'Seward Port', lat: 60.1042, lng: -149.4422, radius: 2000 },
  { name: 'Juneau Port', lat: 58.3019, lng: -134.4197, radius: 2000 },
  { name: 'Ketchikan Port', lat: 55.3422, lng: -131.6461, radius: 2000 },
  { name: 'Skagway Port', lat: 59.4582, lng: -135.3140, radius: 2000 },
  { name: 'Sitka Port', lat: 57.0531, lng: -135.3300, radius: 2000 },
  { name: 'Victoria BC', lat: 48.4284, lng: -123.3656, radius: 2000 },
  
  // === HAWAII & PACIFIC ISLANDS ===
  { name: 'Honolulu Port', lat: 21.3099, lng: -157.8581, radius: 2000 },
  { name: 'Maui Kahului', lat: 20.8947, lng: -156.4700, radius: 2000 },
  { name: 'Kauai Nawiliwili', lat: 21.9544, lng: -159.3561, radius: 2000 },
  { name: 'Kona Port', lat: 19.6400, lng: -155.9969, radius: 2000 },
  { name: 'Hilo Port', lat: 19.7297, lng: -155.0890, radius: 2000 },
  { name: 'Papeete Tahiti', lat: -17.5516, lng: -149.5585, radius: 2000 },
  { name: 'Bora Bora', lat: -16.5004, lng: -151.7415, radius: 1500 },
  { name: 'Moorea', lat: -17.5388, lng: -149.8295, radius: 1500 },
  { name: 'Fiji Suva', lat: -18.1416, lng: 178.4419, radius: 2000 },
  { name: 'Samoa Apia', lat: -13.8507, lng: -171.7514, radius: 2000 },
  
  // === ASIA PACIFIC ===
  { name: 'Tokyo Port', lat: 35.6762, lng: 139.6503, radius: 2000 },
  { name: 'Yokohama Port', lat: 35.4437, lng: 139.6380, radius: 2000 },
  { name: 'Osaka Port', lat: 34.6937, lng: 135.5023, radius: 2000 },
  { name: 'Kobe Port', lat: 34.6901, lng: 135.1956, radius: 2000 },
  { name: 'Nagasaki Port', lat: 32.7448, lng: 129.8737, radius: 2000 },
  { name: 'Shanghai Port', lat: 31.2304, lng: 121.4737, radius: 2000 },
  { name: 'Tianjin Port', lat: 39.0842, lng: 117.2009, radius: 2000 },
  { name: 'Hong Kong Port', lat: 22.3193, lng: 114.1694, radius: 2000 },
  { name: 'Singapore Port', lat: 1.2966, lng: 103.8558, radius: 2000 },
  { name: 'Busan Korea', lat: 35.1796, lng: 129.0756, radius: 2000 },
  { name: 'Incheon Korea', lat: 37.4563, lng: 126.7052, radius: 2000 },
  { name: 'Vladivostok Russia', lat: 43.1155, lng: 131.8855, radius: 2000 },
  
  // === SOUTHEAST ASIA ===
  { name: 'Bangkok Laem Chabang', lat: 13.0827, lng: 100.8782, radius: 2000 },
  { name: 'Ho Chi Minh Phu My', lat: 10.5733, lng: 107.0342, radius: 2000 },
  { name: 'Manila Port', lat: 14.5995, lng: 120.9842, radius: 2000 },
  { name: 'Bali Benoa', lat: -8.7467, lng: 115.2213, radius: 2000 },
  { name: 'Jakarta Port', lat: -6.0944, lng: 106.8451, radius: 2000 },
  { name: 'Penang Malaysia', lat: 5.4141, lng: 100.3288, radius: 2000 },
  { name: 'Kuala Lumpur Port Klang', lat: 3.0000, lng: 101.4000, radius: 2000 },
  
  // === AUSTRALIA & NEW ZEALAND ===
  { name: 'Sydney Port', lat: -33.8688, lng: 151.2093, radius: 2000 },
  { name: 'Melbourne Port', lat: -37.8136, lng: 144.9631, radius: 2000 },
  { name: 'Brisbane Port', lat: -27.4698, lng: 153.0251, radius: 2000 },
  { name: 'Cairns Port', lat: -16.9186, lng: 145.7781, radius: 2000 },
  { name: 'Perth Fremantle', lat: -32.0569, lng: 115.7439, radius: 2000 },
  { name: 'Adelaide Port', lat: -34.9285, lng: 138.6007, radius: 2000 },
  { name: 'Hobart Tasmania', lat: -42.8821, lng: 147.3272, radius: 2000 },
  { name: 'Auckland Port', lat: -36.8485, lng: 174.7633, radius: 2000 },
  { name: 'Wellington Port', lat: -41.2865, lng: 174.7762, radius: 2000 },
  { name: 'Christchurch Port', lat: -43.5321, lng: 172.6362, radius: 2000 },
  { name: 'Dunedin Port', lat: -45.8788, lng: 170.5028, radius: 2000 },
  
  // === CARIBBEAN ===
  { name: 'Nassau Bahamas', lat: 25.0443, lng: -77.3504, radius: 2000 },
  { name: 'Freeport Bahamas', lat: 26.5333, lng: -78.7000, radius: 2000 },
  { name: 'Cozumel Mexico', lat: 20.5083, lng: -86.9458, radius: 2000 },
  { name: 'Costa Maya Mexico', lat: 18.7356, lng: -87.6987, radius: 2000 },
  { name: 'Jamaica Ocho Rios', lat: 18.4078, lng: -77.1031, radius: 2000 },
  { name: 'Jamaica Montego Bay', lat: 18.4762, lng: -77.8939, radius: 2000 },
  { name: 'Grand Cayman', lat: 19.3133, lng: -81.2546, radius: 2000 },
  { name: 'St Thomas USVI', lat: 18.3381, lng: -64.8941, radius: 2000 },
  { name: 'St Maarten', lat: 18.0425, lng: -63.0548, radius: 2000 },
  { name: 'Barbados Port', lat: 13.0969, lng: -59.6145, radius: 2000 },
  { name: 'Aruba Oranjestad', lat: 12.5186, lng: -70.0358, radius: 2000 },
  { name: 'Curacao Willemstad', lat: 12.1084, lng: -68.9335, radius: 2000 },
  { name: 'St Lucia Castries', lat: 14.0101, lng: -60.9875, radius: 2000 },
  { name: 'Antigua St Johns', lat: 17.1274, lng: -61.8468, radius: 2000 },
  { name: 'Puerto Rico San Juan', lat: 18.4655, lng: -66.1057, radius: 2000 },
  { name: 'Dominican Republic', lat: 18.4861, lng: -69.9312, radius: 2000 },
  { name: 'Belize City', lat: 17.5046, lng: -88.1962, radius: 2000 },
  { name: 'Roatan Honduras', lat: 16.3248, lng: -86.5300, radius: 2000 },
  
  // === SOUTH AMERICA ===
  { name: 'Buenos Aires Port', lat: -34.6118, lng: -58.3960, radius: 2000 },
  { name: 'Rio de Janeiro Port', lat: -22.9068, lng: -43.1729, radius: 2000 },
  { name: 'Santos Brazil', lat: -23.9618, lng: -46.3322, radius: 2000 },
  { name: 'Valparaiso Chile', lat: -33.0472, lng: -71.6127, radius: 2000 },
  { name: 'Lima Callao Peru', lat: -12.0464, lng: -77.0428, radius: 2000 },
  { name: 'Montevideo Uruguay', lat: -34.9011, lng: -56.1645, radius: 2000 },
  { name: 'Ushuaia Argentina', lat: -54.8019, lng: -68.3030, radius: 2000 },
  { name: 'Punta Arenas Chile', lat: -53.1638, lng: -70.9171, radius: 2000 },
  
  // === TRANSATLANTIC & REPOSITIONING ===
  { name: 'Bermuda Kings Wharf', lat: 32.3293, lng: -64.8351, radius: 2000 },
  { name: 'Azores Ponta Delgada', lat: 37.7412, lng: -25.6756, radius: 2000 },
  { name: 'Madeira Funchal', lat: 32.6669, lng: -16.9241, radius: 2000 },
  { name: 'Canary Islands', lat: 28.1235, lng: -15.4363, radius: 2000 }
];

// Major land masses for distance calculation (at-sea detection)
const MAJOR_COASTLINES = [
  // === PACIFIC OCEAN - NORTH AMERICA ===
  { name: 'California Coast', lat: 34.0, lng: -119.0, radius: 60000 },
  { name: 'Baja California', lat: 28.0, lng: -114.0, radius: 50000 },
  { name: 'Oregon Coast', lat: 44.0, lng: -124.0, radius: 30000 },
  { name: 'Washington Coast', lat: 47.6, lng: -124.0, radius: 25000 },
  { name: 'British Columbia', lat: 52.0, lng: -128.0, radius: 60000 },
  { name: 'Alaska Southeast', lat: 57.0, lng: -135.0, radius: 50000 },
  { name: 'Alaska Peninsula', lat: 58.0, lng: -158.0, radius: 70000 },
  { name: 'Aleutian Islands', lat: 52.0, lng: -174.0, radius: 40000 },
  
  // === PACIFIC OCEAN - ASIA ===
  { name: 'Japan Main Islands', lat: 36.0, lng: 138.0, radius: 80000 },
  { name: 'Japan Kyushu', lat: 32.0, lng: 131.0, radius: 30000 },
  { name: 'Korea Peninsula', lat: 37.0, lng: 127.0, radius: 40000 },
  { name: 'China East Coast', lat: 30.0, lng: 122.0, radius: 70000 },
  { name: 'Taiwan', lat: 24.0, lng: 121.0, radius: 20000 },
  { name: 'Philippines Luzon', lat: 16.0, lng: 121.0, radius: 40000 },
  { name: 'Philippines Mindanao', lat: 8.0, lng: 125.0, radius: 35000 },
  { name: 'Vietnam Coast', lat: 16.0, lng: 108.0, radius: 50000 },
  { name: 'Thailand Gulf', lat: 10.0, lng: 100.0, radius: 30000 },
  { name: 'Malaysia Peninsula', lat: 4.0, lng: 102.0, radius: 35000 },
  { name: 'Indonesia Java', lat: -7.0, lng: 110.0, radius: 60000 },
  { name: 'Indonesia Sumatra', lat: -2.0, lng: 102.0, radius: 70000 },
  { name: 'Indonesia Borneo', lat: 0.0, lng: 114.0, radius: 50000 },
  { name: 'Indonesia Sulawesi', lat: -2.0, lng: 121.0, radius: 40000 },
  { name: 'New Guinea', lat: -5.0, lng: 141.0, radius: 80000 },
  
  // === PACIFIC OCEAN - OCEANIA ===
  { name: 'Australia East', lat: -25.0, lng: 153.0, radius: 100000 },
  { name: 'Australia North', lat: -15.0, lng: 135.0, radius: 80000 },
  { name: 'Australia West', lat: -25.0, lng: 114.0, radius: 70000 },
  { name: 'Australia South', lat: -35.0, lng: 138.0, radius: 60000 },
  { name: 'Tasmania', lat: -42.0, lng: 147.0, radius: 25000 },
  { name: 'New Zealand North', lat: -38.0, lng: 176.0, radius: 40000 },
  { name: 'New Zealand South', lat: -44.0, lng: 170.0, radius: 35000 },
  
  // === PACIFIC ISLANDS ===
  { name: 'Hawaii Chain', lat: 21.0, lng: -157.0, radius: 20000 },
  { name: 'Fiji Islands', lat: -17.0, lng: 178.0, radius: 15000 },
  { name: 'Tahiti Society Islands', lat: -17.5, lng: -149.5, radius: 10000 },
  { name: 'Samoa Islands', lat: -14.0, lng: -171.0, radius: 8000 },
  { name: 'Tonga Islands', lat: -21.0, lng: -175.0, radius: 10000 },
  { name: 'New Caledonia', lat: -21.5, lng: 165.5, radius: 15000 },
  { name: 'Vanuatu', lat: -16.0, lng: 167.0, radius: 12000 },
  { name: 'Solomon Islands', lat: -9.0, lng: 160.0, radius: 20000 },
  { name: 'Micronesia', lat: 7.0, lng: 158.0, radius: 15000 },
  { name: 'Marshall Islands', lat: 9.0, lng: 168.0, radius: 10000 },
  { name: 'Mariana Islands', lat: 15.0, lng: 145.0, radius: 12000 },
  
  // === ATLANTIC OCEAN - AMERICAS ===
  { name: 'Florida Coast', lat: 27.0, lng: -80.0, radius: 50000 },
  { name: 'Georgia Coast', lat: 32.0, lng: -81.0, radius: 30000 },
  { name: 'Carolina Coast', lat: 35.0, lng: -76.0, radius: 40000 },
  { name: 'Virginia Coast', lat: 37.0, lng: -76.0, radius: 30000 },
  { name: 'Mid Atlantic US', lat: 39.0, lng: -74.0, radius: 35000 },
  { name: 'New York Coast', lat: 40.7, lng: -74.0, radius: 25000 },
  { name: 'New England Coast', lat: 42.0, lng: -70.0, radius: 30000 },
  { name: 'Nova Scotia', lat: 45.0, lng: -63.0, radius: 35000 },
  { name: 'Newfoundland', lat: 48.0, lng: -54.0, radius: 40000 },
  { name: 'Labrador Coast', lat: 54.0, lng: -58.0, radius: 45000 },
  
  // === GULF OF MEXICO & CARIBBEAN ===
  { name: 'Texas Coast', lat: 29.0, lng: -94.0, radius: 40000 },
  { name: 'Louisiana Coast', lat: 29.5, lng: -90.0, radius: 30000 },
  { name: 'Alabama Coast', lat: 30.2, lng: -88.0, radius: 20000 },
  { name: 'Florida Gulf', lat: 28.0, lng: -83.0, radius: 35000 },
  { name: 'Mexico Yucatan', lat: 21.0, lng: -88.0, radius: 40000 },
  { name: 'Mexico East Coast', lat: 19.0, lng: -96.0, radius: 45000 },
  { name: 'Cuba', lat: 21.5, lng: -80.0, radius: 50000 },
  { name: 'Jamaica', lat: 18.1, lng: -77.3, radius: 15000 },
  { name: 'Hispaniola', lat: 19.0, lng: -71.0, radius: 25000 },
  { name: 'Puerto Rico', lat: 18.2, lng: -66.5, radius: 12000 },
  { name: 'Lesser Antilles', lat: 15.0, lng: -61.0, radius: 20000 },
  { name: 'Trinidad', lat: 10.5, lng: -61.3, radius: 10000 },
  { name: 'Venezuela Coast', lat: 10.5, lng: -66.0, radius: 40000 },
  { name: 'Colombia Caribbean', lat: 11.0, lng: -74.0, radius: 30000 },
  { name: 'Panama Caribbean', lat: 9.5, lng: -79.5, radius: 20000 },
  { name: 'Central America Caribbean', lat: 13.0, lng: -84.0, radius: 35000 },
  
  // === SOUTH AMERICA ===
  { name: 'Brazil North Coast', lat: 0.0, lng: -50.0, radius: 60000 },
  { name: 'Brazil Northeast', lat: -8.0, lng: -35.0, radius: 50000 },
  { name: 'Brazil Southeast', lat: -23.0, lng: -43.0, radius: 45000 },
  { name: 'Brazil South', lat: -28.0, lng: -49.0, radius: 35000 },
  { name: 'Uruguay Coast', lat: -34.0, lng: -54.0, radius: 20000 },
  { name: 'Argentina Coast', lat: -38.0, lng: -57.0, radius: 50000 },
  { name: 'Patagonia Atlantic', lat: -45.0, lng: -65.0, radius: 40000 },
  { name: 'Tierra del Fuego', lat: -54.0, lng: -68.0, radius: 25000 },
  { name: 'Chile South', lat: -45.0, lng: -74.0, radius: 60000 },
  { name: 'Chile Central', lat: -33.0, lng: -71.5, radius: 40000 },
  { name: 'Chile North', lat: -23.0, lng: -70.0, radius: 35000 },
  { name: 'Peru Coast', lat: -12.0, lng: -77.0, radius: 40000 },
  { name: 'Ecuador Coast', lat: -2.0, lng: -81.0, radius: 25000 },
  { name: 'Colombia Pacific', lat: 4.0, lng: -77.0, radius: 30000 },
  { name: 'Panama Pacific', lat: 8.0, lng: -79.0, radius: 20000 },
  
  // === ATLANTIC OCEAN - EUROPE & AFRICA ===
  { name: 'Morocco Coast', lat: 33.0, lng: -7.0, radius: 40000 },
  { name: 'Portugal Coast', lat: 39.0, lng: -9.0, radius: 30000 },
  { name: 'Spain Atlantic', lat: 43.0, lng: -8.0, radius: 35000 },
  { name: 'France Atlantic', lat: 46.0, lng: -2.0, radius: 40000 },
  { name: 'UK South Coast', lat: 50.5, lng: -2.0, radius: 35000 },
  { name: 'Ireland', lat: 53.0, lng: -8.0, radius: 30000 },
  { name: 'UK West Coast', lat: 55.0, lng: -5.0, radius: 35000 },
  { name: 'Iceland', lat: 65.0, lng: -18.0, radius: 25000 },
  { name: 'Greenland South', lat: 60.0, lng: -44.0, radius: 50000 },
  { name: 'Greenland East', lat: 68.0, lng: -30.0, radius: 60000 },
  { name: 'West Africa North', lat: 20.0, lng: -17.0, radius: 50000 },
  { name: 'West Africa Central', lat: 5.0, lng: -5.0, radius: 60000 },
  { name: 'West Africa South', lat: -15.0, lng: 12.0, radius: 50000 },
  { name: 'South Africa West', lat: -30.0, lng: 17.0, radius: 35000 },
  { name: 'South Africa South', lat: -34.5, lng: 20.0, radius: 40000 },
  
  // === MEDITERRANEAN SEA ===
  { name: 'Spain Mediterranean', lat: 39.0, lng: 0.0, radius: 40000 },
  { name: 'France Mediterranean', lat: 43.0, lng: 6.0, radius: 25000 },
  { name: 'Italy West', lat: 42.0, lng: 11.0, radius: 35000 },
  { name: 'Italy South', lat: 38.0, lng: 16.0, radius: 30000 },
  { name: 'Italy East', lat: 42.0, lng: 18.0, radius: 35000 },
  { name: 'Balkans Coast', lat: 42.0, lng: 19.0, radius: 40000 },
  { name: 'Greece Mainland', lat: 38.0, lng: 23.0, radius: 35000 },
  { name: 'Turkey Mediterranean', lat: 36.0, lng: 32.0, radius: 45000 },
  { name: 'Cyprus', lat: 35.0, lng: 33.0, radius: 15000 },
  { name: 'Levant Coast', lat: 33.0, lng: 35.0, radius: 30000 },
  { name: 'Egypt Mediterranean', lat: 31.0, lng: 30.0, radius: 35000 },
  { name: 'Libya Coast', lat: 32.0, lng: 20.0, radius: 50000 },
  { name: 'Tunisia Coast', lat: 36.0, lng: 10.0, radius: 25000 },
  { name: 'Algeria Coast', lat: 36.5, lng: 3.0, radius: 40000 },
  { name: 'Morocco Mediterranean', lat: 35.5, lng: -5.0, radius: 20000 },
  
  // === BALTIC & NORTH SEA ===
  { name: 'Norway Coast', lat: 62.0, lng: 6.0, radius: 80000 },
  { name: 'Sweden West', lat: 58.0, lng: 11.0, radius: 40000 },
  { name: 'Denmark', lat: 56.0, lng: 10.0, radius: 25000 },
  { name: 'Germany Baltic', lat: 54.0, lng: 13.0, radius: 20000 },
  { name: 'Poland Coast', lat: 54.5, lng: 18.0, radius: 25000 },
  { name: 'Baltic States', lat: 57.0, lng: 24.0, radius: 35000 },
  { name: 'Finland Coast', lat: 60.0, lng: 25.0, radius: 40000 },
  { name: 'Russia Baltic', lat: 60.0, lng: 28.0, radius: 30000 },
  { name: 'Sweden East', lat: 59.0, lng: 18.0, radius: 45000 },
  
  // === INDIAN OCEAN ===
  { name: 'East Africa Coast', lat: -5.0, lng: 40.0, radius: 60000 },
  { name: 'Somalia Coast', lat: 5.0, lng: 48.0, radius: 50000 },
  { name: 'Arabian Peninsula', lat: 20.0, lng: 55.0, radius: 70000 },
  { name: 'Iran Coast', lat: 27.0, lng: 56.0, radius: 40000 },
  { name: 'Pakistan Coast', lat: 25.0, lng: 66.0, radius: 35000 },
  { name: 'India West Coast', lat: 15.0, lng: 73.0, radius: 60000 },
  { name: 'India South', lat: 10.0, lng: 77.0, radius: 30000 },
  { name: 'India East Coast', lat: 15.0, lng: 80.0, radius: 50000 },
  { name: 'Sri Lanka', lat: 7.0, lng: 81.0, radius: 20000 },
  { name: 'Bangladesh Coast', lat: 22.0, lng: 91.0, radius: 25000 },
  { name: 'Myanmar Coast', lat: 16.0, lng: 96.0, radius: 40000 },
  { name: 'Thailand Andaman', lat: 8.0, lng: 98.0, radius: 30000 },
  { name: 'Malaysia West', lat: 4.0, lng: 100.0, radius: 35000 },
  { name: 'Sumatra West', lat: 0.0, lng: 100.0, radius: 60000 },
  { name: 'Madagascar', lat: -20.0, lng: 47.0, radius: 50000 },
  { name: 'Mauritius Region', lat: -20.0, lng: 57.0, radius: 15000 },
  { name: 'Seychelles', lat: -5.0, lng: 55.0, radius: 10000 },
  { name: 'Maldives', lat: 4.0, lng: 73.0, radius: 12000 },
  
  // === ARCTIC OCEAN ===
  { name: 'Norway Arctic', lat: 70.0, lng: 20.0, radius: 50000 },
  { name: 'Russia Arctic', lat: 72.0, lng: 60.0, radius: 100000 },
  { name: 'Canada Arctic', lat: 72.0, lng: -100.0, radius: 80000 },
  { name: 'Alaska Arctic', lat: 70.0, lng: -150.0, radius: 60000 },
  { name: 'Svalbard', lat: 78.0, lng: 20.0, radius: 20000 },
  
  // === ANTARCTIC ===
  { name: 'Antarctic Peninsula', lat: -65.0, lng: -60.0, radius: 40000 },
  { name: 'Ross Sea Region', lat: -75.0, lng: -175.0, radius: 50000 },
  { name: 'East Antarctica', lat: -70.0, lng: 90.0, radius: 100000 }
];

export interface ShipDetectionResult {
  isOnShip: boolean;
  isAtSea: boolean;
  isNearPort: boolean;
  confidence: number;
  distanceFromLand: number;
  seaState: 'calm' | 'moderate' | 'rough';
  shipMotionDetected: boolean;
  recommendedShipMode: boolean;
  detectionReason: string;
}

export class ShipDetectionService {
  static async detectShipEnvironment(): Promise<ShipDetectionResult> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return this.createDefaultResult('Location permission denied');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation
      });

      const { latitude, longitude, altitude, accuracy } = location.coords;

      // Check proximity to cruise ports
      const portResult = this.checkPortProximity(latitude, longitude);
      
      // Check if at sea (distance from land)
      const seaResult = this.checkAtSeaStatus(latitude, longitude, altitude, accuracy);
      
      // Determine overall ship detection
      const isOnShip = portResult.isNearPort || seaResult.isAtSea || seaResult.shipMotionDetected;
      
      const result: ShipDetectionResult = {
        isOnShip,
        isAtSea: seaResult.isAtSea,
        isNearPort: portResult.isNearPort,
        confidence: this.calculateConfidence(portResult, seaResult, accuracy),
        distanceFromLand: seaResult.distanceFromLand,
        seaState: seaResult.seaState,
        shipMotionDetected: seaResult.shipMotionDetected,
        recommendedShipMode: isOnShip,
        detectionReason: this.getDetectionReason(portResult, seaResult)
      };

      console.log(`Ship Detection Result:`, result);
      return result;

    } catch (error) {
      console.error('Error detecting ship environment:', error);
      return this.createDefaultResult('Detection error');
    }
  }

  private static checkPortProximity(lat: number, lng: number) {
    let isNearPort = false;
    let nearestPort = '';
    let minDistance = Infinity;

    for (const area of CRUISE_SHIP_AREAS) {
      const distance = this.calculateDistance(lat, lng, area.lat, area.lng);
      if (distance <= area.radius) {
        isNearPort = true;
        if (distance < minDistance) {
          minDistance = distance;
          nearestPort = area.name;
        }
      }
    }

    return { isNearPort, nearestPort, portDistance: minDistance };
  }

  private static checkAtSeaStatus(lat: number, lng: number, altitude: number | null, accuracy: number | null) {
    // Calculate distance from nearest land
    const distanceFromLand = this.calculateDistanceFromLand(lat, lng);
    
    // At sea if more than 5km from any major coastline
    const isAtSea = distanceFromLand > 5000;
    
    // Determine sea state based on GPS accuracy and altitude
    const seaState = this.determineSeaState(accuracy, altitude);
    
    // Detect ship motion patterns (elevated position + GPS characteristics)
    const shipMotionDetected = this.detectShipMotion(altitude, accuracy, distanceFromLand);

    return {
      isAtSea,
      distanceFromLand,
      seaState,
      shipMotionDetected
    };
  }

  private static calculateDistanceFromLand(lat: number, lng: number): number {
    let minDistance = Infinity;

    for (const coast of MAJOR_COASTLINES) {
      const distance = this.calculateDistance(lat, lng, coast.lat, coast.lng);
      // Adjust for coastline radius (approximate land mass size)
      const adjustedDistance = Math.max(0, distance - coast.radius);
      minDistance = Math.min(minDistance, adjustedDistance);
    }

    return minDistance;
  }

  private static determineSeaState(accuracy: number | null, altitude: number | null): 'calm' | 'moderate' | 'rough' {
    if (!accuracy) return 'moderate';
    
    // GPS accuracy degrades in rough seas due to ship motion
    if (accuracy < 5) return 'calm';
    if (accuracy < 15) return 'moderate';
    return 'rough';
  }

  private static detectShipMotion(altitude: number | null, accuracy: number | null, distanceFromLand: number): boolean {
    // Ship motion indicators:
    // 1. Elevated position (ship decks are 10-80m above sea level)
    // 2. Varying GPS accuracy (due to ship movement)
    // 3. Distance from land
    
    const elevatedPosition = altitude && altitude > 8 && altitude < 100;
    const maritimeGPS = accuracy && accuracy > 3; // Ships have less stable GPS
    const openWater = distanceFromLand > 1000;
    
    return !!(elevatedPosition && (maritimeGPS || openWater));
  }

  private static calculateConfidence(portResult: any, seaResult: any, accuracy: number | null): number {
    let confidence = 0;

    // Port proximity (high confidence)
    if (portResult.isNearPort) confidence += 90;
    
    // At sea detection (medium-high confidence)
    else if (seaResult.isAtSea) confidence += 75;
    
    // Ship motion detected (medium confidence)
    else if (seaResult.shipMotionDetected) confidence += 60;

    // GPS accuracy factor
    if (accuracy) {
      if (accuracy < 10) confidence += 10;
      else if (accuracy > 20) confidence -= 10;
    }

    // Sea state factor
    if (seaResult.seaState === 'rough') confidence += 15;
    else if (seaResult.seaState === 'calm') confidence += 5;

    return Math.max(0, Math.min(100, confidence));
  }

  private static getDetectionReason(portResult: any, seaResult: any): string {
    if (portResult.isNearPort) {
      return `Near ${portResult.nearestPort}`;
    }
    if (seaResult.isAtSea) {
      return `At sea (${(seaResult.distanceFromLand / 1000).toFixed(1)}km from land)`;
    }
    if (seaResult.shipMotionDetected) {
      return `Ship motion detected`;
    }
    return 'No ship environment detected';
  }

  private static createDefaultResult(reason: string): ShipDetectionResult {
    return {
      isOnShip: false,
      isAtSea: false,
      isNearPort: false,
      confidence: 0,
      distanceFromLand: 0,
      seaState: 'calm',
      shipMotionDetected: false,
      recommendedShipMode: false,
      detectionReason: reason
    };
  }

  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Continuous monitoring for at-sea detection
  static startContinuousDetection(
    callback: (result: ShipDetectionResult) => void,
    intervalMs: number = 30000
  ): NodeJS.Timeout {
    const interval = setInterval(async () => {
      const result = await this.detectShipEnvironment();
      callback(result);
    }, intervalMs);

    return interval;
  }

  static stopContinuousDetection(interval: NodeJS.Timeout): void {
    clearInterval(interval);
  }
}

export default ShipDetectionService;
