// Venezuela Geographic Reference Data - 24 states, all cities and municipalities
// Source: CodersVenezuela/Venezuela-JSON
// Structure: State > Cities[] + Municipalities[] (independent lists)

export interface VenezuelaState {
  code: string;
  name: string;
  cities: string[];
  municipalities: string[];
}

export const VENEZUELA_STATES: VenezuelaState[] = [
  {
    code: "X",
    name: "Amazonas",
    cities: ["Maroa","Puerto Ayacucho","San Fernando de Atabapo"],
    municipalities: ["Alto Orinoco","Atabapo","Atures","Autana","Manapiare","Maroa","Río Negro"],
  },
  {
    code: "B",
    name: "Anzoátegui",
    cities: ["Anaco","Aragua de Barcelona","Barcelona","Boca de Uchire","Cantaura","Clarines","El Chaparro","El Pao Anzoátegui","El Tigre","El Tigrito","Guanape","Guanta","Lechería","Onoto","Pariaguán","Píritu","Puerto La Cruz","Puerto Píritu","Sabana de Uchire","San Mateo Anzoátegui","San Pablo Anzoátegui","San Tomé","Santa Ana de Anzoátegui","Santa Fe Anzoátegui","Santa Rosa","Soledad","Urica","Valle de Guanape"],
    municipalities: ["Anaco","Aragua","Bolívar","Bruzual","Cajigal","Carvajal","Diego Bautista Urbaneja","Freites","Guanipa","Guanta","Independencia","Libertad","McGregor","Miranda","Monagas","Peñalver","Píritu","San Juan de Capistrano","Santa Ana","Simón Rodríguez","Sotillo"],
  },
  {
    code: "C",
    name: "Apure",
    cities: ["Achaguas","Biruaca","Bruzual","El Amparo","El Nula","Elorza","Guasdualito","Mantecal","Puerto Páez","San Fernando de Apure","San Juan de Payara"],
    municipalities: ["Achaguas","Biruaca","Muñoz","Páez","Pedro Camejo","Rómulo Gallegos","San Fernando"],
  },
  {
    code: "D",
    name: "Aragua",
    cities: ["Barbacoas","Cagua","Camatagua","Choroní","Colonia Tovar","El Consejo","La Victoria","Las Tejerías","Magdaleno","Maracay","Ocumare de La Costa","Palo Negro","San Casimiro","San Mateo","San Sebastián","Santa Cruz de Aragua","Tocorón","Turmero","Villa de Cura","Zuata"],
    municipalities: ["Bolívar","Camatagua","Francisco Linares Alcántara","Girardot","José Ángel Lamas","José Félix Ribas","José Rafael Revenga","Libertador","Mario Briceño Iragorry","Ocumare de la Costa de Oro","San Casimiro","San Sebastián","Santiago Mariño","Santos Michelena","Sucre","Tovar","Urdaneta","Zamora"],
  },
  {
    code: "E",
    name: "Barinas",
    cities: ["Barinas","Barinitas","Barrancas","Calderas","Capitanejo","Ciudad Bolivia","El Cantón","Las Veguitas","Libertad de Barinas","Sabaneta","Santa Bárbara de Barinas","Socopó"],
    municipalities: ["Alberto Arvelo Torrealba","Andrés Eloy Blanco","Antonio José de Sucre","Arismendi","Barinas","Bolívar","Cruz Paredes","Ezequiel Zamora","Obispos","Pedraza","Rojas","Sosa"],
  },
  {
    code: "F",
    name: "Bolívar",
    cities: ["Caicara del Orinoco","Canaima","Ciudad Bolívar","Ciudad Piar","El Callao","El Dorado","El Manteco","El Palmar","El Pao","Guasipati","Guri","La Paragua","Matanzas","Puerto Ordaz","San Félix","Santa Elena de Uairén","Tumeremo","Unare","Upata"],
    municipalities: ["Angostura","Caroní","Cedeño","El Callao","Gran Sabana","Heres","Padre Pedro Chien","Píar","Roscio","Sifontes","Sucre"],
  },
  {
    code: "G",
    name: "Carabobo",
    cities: ["Bejuma","Belén","Campo de Carabobo","Canoabo","Central Tacarigua","Chirgua","Ciudad Alianza","El Palito","Guacara","Guigue","Las Trincheras","Los Guayos","Mariara","Miranda","Montalbán","Morón","Naguanagua","Puerto Cabello","San Joaquín","Tocuyito","Urama","Valencia","Vigirimita"],
    municipalities: ["Bejuma","Carlos Arvelo","Diego Ibarra","Guacara","Libertador","Los Guayos","Miranda","Montalbán","Mora","Naguanagua","Puerto Cabello","San Diego","San Joaquín","Valencia"],
  },
  {
    code: "H",
    name: "Cojedes",
    cities: ["Aguirre","Apartaderos Cojedes","Arismendi","Camuriquito","El Baúl","El Limón","El Pao Cojedes","El Socorro","La Aguadita","Las Vegas","Libertad de Cojedes","Mapuey","Piñedo","Samancito","San Carlos","Sucre","Tinaco","Tinaquillo","Vallecito"],
    municipalities: ["Anzoátegui","Girardot","Lima Blanco","Pao de San Juan Bautista","Ricaurte","Rómulo Gallegos","San Carlos","Tinaco","Tinaquillo"],
  },
  {
    code: "Y",
    name: "Delta Amacuro",
    cities: ["Tucupita"],
    municipalities: ["Antonio Díaz","Casacoima","Pedernales","Tucupita"],
  },
  {
    code: "A",
    name: "Distrito Capital",
    cities: [],
    municipalities: ["Libertador"],
  },
  {
    code: "I",
    name: "Falcón",
    cities: ["Adícora","Boca de Aroa","Cabure","Capadare","Capatárida","Chichiriviche","Churuguara","Coro","Cumarebo","Dabajuro","Judibana","La Cruz de Taratara","La Vela de Coro","Los Taques","Maparari","Mene de Mauroa","Mirimire","Pedregal","Píritu Falcón","Pueblo Nuevo Falcón","Puerto Cumarebo","Punta Cardón","Punto Fijo","San Juan de Los Cayos","San Luis","Santa Ana Falcón","Santa Cruz De Bucaral","Tocopero","Tocuyo de La Costa","Tucacas","Yaracal"],
    municipalities: ["Acosta","Bolívar","Buchivacoa","Carirubana","Colina","Dabajuro","Democracia","Falcón","Federación","Jacura","Los Taques","Manaure","Mauroa","Miranda","Monseñor Iturriza","Palmasola","Petit","Píritu","San Francisco","Silva","Sucre","Tocópero","Unión","Urumaco","Zamora"],
  },
  {
    code: "J",
    name: "Guárico",
    cities: ["Altagracia de Orituco","Cabruta","Calabozo","Camaguán","Chaguaramas Guárico","El Socorro","El Sombrero","Las Mercedes de Los Llanos","Lezama","Onoto","Ortíz","San José de Guaribe","San Juan de Los Morros","San Rafael de Laya","Santa María de Ipire","Tucupido","Valle de La Pascua","Zaraza"],
    municipalities: ["Camaguán","Chaguaramas","El Socorro","Infante","Las Mercedes","Mellado","Miranda","Monagas","Ortiz","Ribas","Roscio","San Gerónimo de Guayabal","San José de Guaribe","Santa María de Ipire","Zaraza"],
  },
  {
    code: "K",
    name: "Lara",
    cities: ["Aguada Grande","Atarigua","Barquisimeto","Bobare","Cabudare","Carora","Cubiro","Cují","Duaca","El Manzano","El Tocuyo","Guaríco","Humocaro Alto","Humocaro Bajo","La Miel","Moroturo","Quíbor","Río Claro","Sanare","Santa Inés","Sarare","Siquisique","Tintorero"],
    municipalities: ["Andrés Eloy Blanco","Crespo","Iribarren","Jiménez","Morán","Palavecino","Simón Planas","Torres","Urdaneta"],
  },
  {
    code: "L",
    name: "Mérida",
    cities: ["Apartaderos Mérida","Arapuey","Bailadores","Caja Seca","Canaguá","Chachopo","Chiguara","Ejido","El Vigía","La Azulita","La Playa","Lagunillas Mérida","Mérida","Mesa de Bolívar","Mucuchíes","Mucujepe","Mucuruba","Nueva Bolivia","Palmarito","Pueblo Llano","Santa Cruz de Mora","Santa Elena de Arenales","Santo Domingo","Tabáy","Timotes","Torondoy","Tovar","Tucani","Zea"],
    municipalities: ["Alberto Adriani","Andrés Bello","Antonio Pinto Salinas","Aricagua","Arzobispo Chacón","Campo Elías","Caracciolo Parra Olmedo","Cardenal Quintero","Guaraque","Julio César Salas","Justo Briceño","Libertador","Miranda","Obispo Ramos de Lora","Padre Noguera","Pueblo Llano","Rangel","Rivas Dávila","Santos Marquina","Sucre","Tovar","Tulio Febres Cordero","Zea"],
  },
  {
    code: "M",
    name: "Miranda",
    cities: ["Araguita","Carrizal","Caucagua","Chaguaramas Miranda","Charallave","Chirimena","Chuspa","Cúa","Cupira","Curiepe","El Guapo","El Jarillo","Filas de Mariche","Guarenas","Guatire","Higuerote","Los Anaucos","Los Teques","Ocumare del Tuy","Panaquire","Paracotos","Río Chico","San Antonio de Los Altos","San Diego de Los Altos","San Fernando del Guapo","San Francisco de Yare","San José de Los Altos","San José de Río Chico","San Pedro de Los Altos","Santa Lucía","Santa Teresa","Tacarigua de La Laguna","Tacarigua de Mamporal","Tácata","Turumo"],
    municipalities: ["Acevedo","Andrés Bello","Baruta","Brión","Buroz","Carrizal","Chacao","Cristóbal Rojas","El Hatillo","Guaicaipuro","Independencia","Lander","Los Salias","Páez","Paz Castillo","Pedro Gual","Plaza","Simón Bolívar","Sucre","Urdaneta","Zamora"],
  },
  {
    code: "N",
    name: "Monagas",
    cities: ["Aguasay","Aragua de Maturín","Barrancas del Orinoco","Caicara de Maturín","Caripe","Caripito","Chaguaramal","Chaguaramas Monagas","El Furrial","El Tejero","Jusepín","La Toscana","Maturín","Miraflores","Punta de Mata","Quiriquire","San Antonio de Maturín","San Vicente Monagas","Santa Bárbara","Temblador","Teresen","Uracoa"],
    municipalities: ["Acosta","Aguasay","Bolívar","Caripe","Cedeño","Ezequiel Zamora","Libertador","Maturín","Piar","Punceres","Santa Bárbara","Sotillo","Uracoa"],
  },
  {
    code: "O",
    name: "Nueva Esparta",
    cities: ["Altagracia","Boca de Pozo","Boca de Río","El Espinal","El Valle del Espíritu Santo","El Yaque","Juangriego","La Asunción","La Guardia","Pampatar","Porlamar","Puerto Fermín","Punta de Piedras","San Francisco de Macanao","San Juan Bautista","San Pedro de Coche","Santa Ana de Nueva Esparta","Villa Rosa"],
    municipalities: ["Antolín del Campo","Arismendi","Díaz","García","Gómez","Maneiro","Marcano","Mariño","Península de Macanao","Tubores","Villalba"],
  },
  {
    code: "P",
    name: "Portuguesa",
    cities: ["Acarigua","Agua Blanca","Araure","Biscucuy","Boconoito","Campo Elías","Chabasquén","Guanare","Guanarito","La Aparición","La Misión","Mesa de Cavacas","Ospino","Papelón","Payara","Pimpinela","Píritu de Portuguesa","San Rafael de Onoto","Santa Rosalía","Turén"],
    municipalities: ["Agua Blanca","Araure","Esteller","Guanare","Guanarito","Monseñor José Vicente de Unda","Ospino","Páez","Papelón","San Genaro de Boconoíto","San Rafael de Onoto","Santa Rosalía","Sucre","Turén"],
  },
  {
    code: "R",
    name: "Sucre",
    cities: ["Altos de Sucre","Araya","Cariaco","Carúpano","Casanay","Cumaná","Cumanacoa","El Morro Puerto Santo","El Pilar","El Poblado","Guaca","Guiria","Irapa","Manicuare","Mariguitar","Río Caribe","San Antonio del Golfo","San José de Aerocuar","San Vicente de Sucre","Santa Fe de Sucre","Tunapuy","Yaguaraparo","Yoco"],
    municipalities: ["Andrés Eloy Blanco","Andrés Mata","Arismendi","Benítez","Bermúdez","Bolívar","Cajigal","Cruz Salmerón Acosta","Libertador","Mariño","Mejía","Montes","Ribero","Sucre","Valdez"],
  },
  {
    code: "S",
    name: "Táchira",
    cities: ["Abejales","Borota","Bramon","Capacho","Colón","Coloncito","Cordero","El Cobre","El Pinal","Independencia","La Fría","La Grita","La Pedrera","La Tendida","Las Delicias","Las Hernández","Lobatera","Michelena","Palmira","Pregonero","Queniquea","Rubio","San Antonio del Tachira","San Cristobal","San José de Bolívar","San Josecito","San Pedro del Río","Santa Ana Táchira","Seboruco","Táriba","Umuquena"],
    municipalities: ["Andrés Bello","Antonio Rómulo Costa","Ayacucho","Bolívar","Cárdenas","Córdoba","Fernández Feo","Francisco de Miranda","García de Hevia","Guásimos","Independencia","Jáuregui","José María Vargas","Junín","Libertad","Libertador","Lobatera","Michelena","Panamericano","Pedro María Ureña","Rafael Urdaneta","Samuel Darío Maldonado","San Cristóbal","San Judas Tadeo","Seboruco","Simón Rodríguez","Sucre","Torbes","Uribante"],
  },
  {
    code: "T",
    name: "Trujillo",
    cities: ["Batatal","Betijoque","Boconó","Carache","Chejende","Cuicas","El Dividive","El Jaguito","Escuque","Isnotú","Jajó","La Ceiba","La Concepción de Trujllo","La Mesa de Esnujaque","La Puerta","La Quebrada","Mendoza Fría","Meseta de Chimpire","Monay","Motatán","Pampán","Pampanito","Sabana de Mendoza","San Lázaro","Santa Ana de Trujillo","Tostós","Trujillo","Valera"],
    municipalities: ["Andrés Bello","Boconó","Bolívar","Candelaria","Carache","Escuque","José Felipe Márquez Cañizalez","Juan Vicente Campos Elías","La Ceiba","Miranda","Monte Carmelo","Motatán","Pampán","Pampanito","Rafael Rangel","San Rafael de Carvajal","Sucre","Trujillo","Urdaneta","Valera"],
  },
  {
    code: "W",
    name: "Vargas",
    cities: ["Carayaca","Litoral"],
    municipalities: ["Vargas"],
  },
  {
    code: "U",
    name: "Yaracuy",
    cities: ["Aroa","Boraure","Campo Elías de Yaracuy","Chivacoa","Cocorote","Farriar","Guama","Marín","Nirgua","Sabana de Parra","Salom","San Felipe","San Pablo de Yaracuy","Urachiche","Yaritagua","Yumare"],
    municipalities: ["Arístides Bastidas","Bolívar","Bruzual","Cocorote","Independencia","José Antonio Páez","La Trinidad","Manuel Monge","Nirgua","Peña","San Felipe","Sucre","Urachiche","Veroes"],
  },
  {
    code: "V",
    name: "Zulia",
    cities: ["Bachaquero","Bobures","Cabimas","Campo Concepción","Campo Mara","Campo Rojo","Carrasquero","Casigua","Chiquinquirá","Ciudad Ojeda","El Batey","El Carmelo","El Chivo","El Guayabo","El Mene","El Venado","Encontrados","Gibraltar","Isla de Toas","La Concepción","La Paz","La Sierrita","Lagunillas","Las Piedras","Los Cortijos","Machiques","Maracaibo","Mene Grande","Palmarejo","Paraguaipoa","Potrerito","Pueblo Nuevo","Puertos de Altagracia","Punta Gorda","Sabaneta de Palma","San Francisco","San José de Perijá","San Rafael del Moján","San Timoteo","Santa Bárbara del Zulia","Santa Cruz de Mara","Santa Cruz del Zulia","Santa Rita","Sinamaica","Tamare","Tía Juana","Villa Rosario"],
    municipalities: ["Almirante Padilla","Baralt","Cabimas","Catatumbo","Colón","Francisco Javier Pulgar","Jesús Enrique Lossada","Jesús María Semprún","La Cañada de Urdaneta","Lagunillas","Machiques de Perijá","Mara","Maracaibo","Miranda","Páez","Rosario de Perijá","San Francisco","Santa Rita","Simón Bolívar","Sucre","Valmore Rodríguez"],
  },
];

/** Get all states as { code, name } for dropdown */
export function getStates(): { code: string; name: string }[] {
  return VENEZUELA_STATES.map((s) => ({ code: s.code, name: s.name }));
}

/** Get cities for a given state code */
export function getCitiesByState(stateCode: string): { code: string; name: string }[] {
  const state = VENEZUELA_STATES.find((s) => s.code === stateCode);
  if (!state) return [];
  return state.cities.map((c) => ({ code: c, name: c }));
}

/** Get municipalities for a given state code */
export function getMunicipalitiesByState(stateCode: string): { code: string; name: string }[] {
  const state = VENEZUELA_STATES.find((s) => s.code === stateCode);
  if (!state) return [];
  return state.municipalities.map((m) => ({ code: m, name: m }));
}
