// =============================================================
//  lessons.js — Educational lesson + quiz content
//  Each lesson: 3 slides, then a short kid-friendly quiz.
// =============================================================

export const LESSONS = [
  {
    id: 'seedcycle',
    title: 'The Seed Cycle',
    emoji: '🌱',
    color: '#3fa34d',
    reward: 25,
    xp: 30,
    slides: [
      { emoji: '🌰', title: 'It starts with a seed', text: 'Every plant begins as a tiny seed. We tuck the seed into soft soil to keep it cozy.' },
      { emoji: '🌧️', title: 'Water wakes it up', text: 'When the seed drinks water and feels the warm sun, a little sprout pops up!' },
      { emoji: '🌻', title: 'It grows up big', text: 'The sprout grows leaves, then flowers, then food we can harvest. Then it makes new seeds!' },
    ],
    quiz: [
      {
        q: 'What does a plant grow from?',
        options: ['A rock', 'A seed', 'A cloud'],
        answer: 1,
        hint: 'It is tiny and we plant it in soil!',
      },
      {
        q: 'What helps a seed wake up and sprout?',
        options: ['Water and sun', 'Loud music', 'Nothing at all'],
        answer: 0,
      },
    ],
  },
  {
    id: 'soilwater',
    title: 'Soil & Water',
    emoji: '💧',
    color: '#2a6fdb',
    reward: 25,
    xp: 30,
    slides: [
      { emoji: '🟫', title: 'Soil is plant food', text: 'Soil holds water and yummy nutrients. Roots drink them up to stay strong.' },
      { emoji: '💧', title: 'Plants get thirsty', text: 'Just like you, plants need water every day. Watered crops grow much faster!' },
      { emoji: '☀️', title: 'Not too much, not too little', text: 'Plants love a good drink and warm sunshine. Too little water makes them grow slow.' },
    ],
    quiz: [
      {
        q: 'Why do we water our crops?',
        options: ['To make mud pies', 'So they grow faster and stronger', 'To make them cold'],
        answer: 1,
      },
      {
        q: 'Where do roots get nutrients?',
        options: ['From the soil', 'From the moon', 'From the wind'],
        answer: 0,
      },
    ],
  },
  {
    id: 'vehicles',
    title: 'Farm Vehicle Match',
    emoji: '🚜',
    color: '#e9c46a',
    reward: 30,
    xp: 35,
    slides: [
      { emoji: '🚜', title: 'The mighty tractor', text: 'Tractors pull big tools to till soil and plant lots of seeds quickly.' },
      { emoji: '🛻', title: 'The handy truck', text: 'Trucks carry water and haul the harvest to market in their big back bed.' },
      { emoji: '🛵', title: 'The speedy quad', text: 'Quad bikes have 4 fat tyres to zoom across bumpy fields super fast.' },
    ],
    quiz: [
      {
        q: 'Which vehicle is best for hauling a big harvest?',
        options: ['Quad bike', 'Truck', 'Skateboard'],
        answer: 1,
      },
      {
        q: 'What does a tractor do?',
        options: ['Bakes bread', 'Tills soil and plants seeds', 'Flies in the sky'],
        answer: 1,
      },
    ],
  },
  {
    id: 'seasons',
    title: 'Crops & Seasons',
    emoji: '🍓',
    color: '#ff5d8f',
    reward: 30,
    xp: 35,
    slides: [
      { emoji: '🥕', title: 'Crops grow differently', text: 'Carrots grow down into the soil, while strawberries grow on little leafy plants.' },
      { emoji: '🎃', title: 'Some take longer', text: 'Big crops like pumpkins take more time to grow, but give you more coins!' },
      { emoji: '🌈', title: 'Variety is healthy', text: 'Eating many different fruits and veggies helps our bodies stay strong and happy.' },
    ],
    quiz: [
      {
        q: 'Which crop grows DOWN into the soil?',
        options: ['Carrot', 'Strawberry', 'Pumpkin'],
        answer: 0,
      },
      {
        q: 'Why should we eat many different crops?',
        options: ['To stay strong and healthy', 'Because they are heavy', 'To make them sad'],
        answer: 0,
      },
    ],
  },
];

export const getLesson = (id) => LESSONS.find((l) => l.id === id);
