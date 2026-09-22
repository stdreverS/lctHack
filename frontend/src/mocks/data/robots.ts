// Демо-каталог: производители и характеристики условные, не реальные продукты.
import type { Robot } from '@/types/api'

export const ROBOT_IDS = {
  amr600: 'b1f0a3c2-1111-4a01-9c01-000000000001',
  amr1500: 'b1f0a3c2-1111-4a01-9c01-000000000002',
  fmr16: 'b1f0a3c2-1111-4a01-9c01-000000000003',
  fmr12narrow: 'b1f0a3c2-1111-4a01-9c01-000000000004',
  stacker12: 'b1f0a3c2-1111-4a01-9c01-000000000005',
  tugger3000: 'b1f0a3c2-1111-4a01-9c01-000000000006',
  tugger1000: 'b1f0a3c2-1111-4a01-9c01-000000000007',
  cleaner: 'b1f0a3c2-1111-4a01-9c01-000000000008',
  shuttle: 'b1f0a3c2-1111-4a01-9c01-000000000009',
  baggage: 'b1f0a3c2-1111-4a01-9c01-000000000010',
} as const

const AMR = 'AMR — автономный мобильный робот'
const FMR = 'FMR — автономный вилочный погрузчик'

export const robots: Robot[] = [
  {
    id: ROBOT_IDS.amr600, name: 'Логимов AMR-600', manufacturer: 'Логимов Роботикс',
    solutionType: 'amr', solutionTypeName: AMR, objectTypes: ['warehouse', 'hospital'],
    country: 'Россия', availability: 'Поставка 8–10 недель',
    price: 4_200_000, raasMonthlyPrice: 115_000, maintenancePerYear: 320_000,
    specs: { payloadKg: 600, speedMps: 1.5, perfOpsPerHour: 45, autonomyH: 10, chargeTimeH: 1.5, positioningMm: 10, navigation: 'Лидар, SLAM', minAisleM: 1.2, widthM: 0.95, lengthM: 1.3, heightM: 0.3, lifeYears: 7 },
    sourceUrl: 'https://example.com/catalog/logimov-amr-600', sourceDate: '2026-06-15', confirmed: true,
  },
  {
    id: ROBOT_IDS.amr1500, name: 'Логимов AMR-1500', manufacturer: 'Логимов Роботикс',
    solutionType: 'amr', solutionTypeName: AMR, objectTypes: ['warehouse'],
    country: 'Россия', availability: 'Поставка 10–12 недель',
    price: 6_800_000, raasMonthlyPrice: 175_000, maintenancePerYear: 480_000,
    specs: { payloadKg: 1500, speedMps: 1.2, perfOpsPerHour: 35, autonomyH: 8, chargeTimeH: 2, positioningMm: 10, navigation: 'Лидар, SLAM', minAisleM: 1.8, widthM: 1.2, lengthM: 1.6, heightM: 0.4, lifeYears: 7 },
    sourceUrl: 'https://example.com/catalog/logimov-amr-1500', sourceDate: '2026-06-15', confirmed: true,
  },
  {
    id: ROBOT_IDS.fmr16, name: 'Автопогрузчик ФМР-16', manufacturer: 'СеверТех',
    solutionType: 'fmr', solutionTypeName: FMR, objectTypes: ['warehouse'],
    country: 'Россия', availability: 'Поставка 12–16 недель',
    price: 9_500_000, raasMonthlyPrice: 240_000, maintenancePerYear: 700_000,
    specs: { payloadKg: 1600, speedMps: 1.4, perfOpsPerHour: 22, autonomyH: 8, chargeTimeH: 2.5, positioningMm: 5, navigation: 'Лидар, отражатели', minAisleM: 3.2, widthM: 1.1, lengthM: 2.4, heightM: 2.2, lifeYears: 8 },
    sourceUrl: 'https://example.com/catalog/severtech-fmr-16', sourceDate: '2026-05-20', confirmed: true,
  },
  {
    id: ROBOT_IDS.fmr12narrow, name: 'ФМР-12 Узкопроходный', manufacturer: 'Восток Автоматика',
    solutionType: 'fmr', solutionTypeName: FMR, objectTypes: ['warehouse'],
    country: 'Китай', availability: 'По запросу',
    price: 11_200_000, raasMonthlyPrice: null, maintenancePerYear: 850_000,
    specs: { payloadKg: 1200, speedMps: 1.1, perfOpsPerHour: null, autonomyH: null, chargeTimeH: null, positioningMm: 5, navigation: 'Лидар, SLAM', minAisleM: 1.9, widthM: 1.0, lengthM: 2.1, heightM: null, lifeYears: null },
    sourceUrl: null, sourceDate: '2026-03-02', confirmed: false,
  },
  {
    id: ROBOT_IDS.stacker12, name: 'Штабелер АШ-12', manufacturer: 'СеверТех',
    solutionType: 'stacker', solutionTypeName: 'Автономный штабелер', objectTypes: ['warehouse'],
    country: 'Россия', availability: 'Поставка 8–12 недель',
    price: 5_600_000, raasMonthlyPrice: 150_000, maintenancePerYear: 410_000,
    specs: { payloadKg: 1200, speedMps: 1.0, perfOpsPerHour: 20, autonomyH: 8, chargeTimeH: 2, positioningMm: 10, navigation: 'Лидар, SLAM', minAisleM: 2.6, widthM: 0.9, lengthM: 1.9, heightM: 2.0, lifeYears: 8 },
    sourceUrl: 'https://example.com/catalog/severtech-ash-12', sourceDate: '2026-05-20', confirmed: true,
  },
  {
    id: ROBOT_IDS.tugger3000, name: 'Тягач АТ-3000', manufacturer: 'Логимов Роботикс',
    solutionType: 'tugger', solutionTypeName: 'Автономный тягач', objectTypes: ['warehouse', 'airport'],
    country: 'Россия', availability: 'Поставка 8–10 недель',
    price: 5_200_000, raasMonthlyPrice: 140_000, maintenancePerYear: 380_000,
    specs: { payloadKg: 3000, speedMps: 1.8, perfOpsPerHour: 30, autonomyH: 9, chargeTimeH: 2, positioningMm: 20, navigation: 'Лидар, магнитная лента', minAisleM: 2.5, widthM: 0.8, lengthM: 1.7, heightM: 1.2, lifeYears: 8 },
    sourceUrl: 'https://example.com/catalog/logimov-at-3000', sourceDate: '2026-06-15', confirmed: true,
  },
  {
    id: ROBOT_IDS.tugger1000, name: 'Тягач АТ-1000 Лайт', manufacturer: 'Восток Автоматика',
    solutionType: 'tugger', solutionTypeName: 'Автономный тягач', objectTypes: ['warehouse', 'hospital'],
    country: null, availability: null,
    price: 3_100_000, raasMonthlyPrice: null, maintenancePerYear: 240_000,
    specs: { payloadKg: 1000, speedMps: 1.5, perfOpsPerHour: 28, autonomyH: null, chargeTimeH: null, positioningMm: null, navigation: null, minAisleM: null, widthM: 0.7, lengthM: 1.4, heightM: null, lifeYears: null },
    sourceUrl: null, sourceDate: null, confirmed: false,
  },
  {
    id: ROBOT_IDS.cleaner, name: 'Уборщик ЧистоБот ПРО-50', manufacturer: 'ЧистоБот',
    solutionType: 'cleaner', solutionTypeName: 'Робот-уборщик', objectTypes: ['warehouse', 'airport', 'hospital'],
    country: 'Россия', availability: 'В наличии',
    price: 2_300_000, raasMonthlyPrice: 65_000, maintenancePerYear: 180_000,
    specs: { payloadKg: null, speedMps: 1.0, perfOpsPerHour: null, autonomyH: 4, chargeTimeH: 3, positioningMm: 50, navigation: 'Лидар, камеры', minAisleM: 1.0, widthM: 0.7, lengthM: 1.1, heightM: 1.1, lifeYears: 6 },
    sourceUrl: 'https://example.com/catalog/chistobot-pro-50', sourceDate: '2026-04-10', confirmed: true,
  },
  {
    id: ROBOT_IDS.shuttle, name: 'Шаттл-система АСХ-Шаттл', manufacturer: 'Интралогика',
    solutionType: 'asrs', solutionTypeName: 'Автоматизированная система хранения', objectTypes: ['warehouse'],
    country: 'Россия', availability: 'Проект 6–9 месяцев',
    price: 48_000_000, raasMonthlyPrice: null, maintenancePerYear: 3_600_000,
    specs: { payloadKg: 50, speedMps: 4, perfOpsPerHour: 600, autonomyH: null, chargeTimeH: null, positioningMm: 2, navigation: 'Рельсовая', minAisleM: null, widthM: null, lengthM: null, heightM: 12, lifeYears: 15 },
    sourceUrl: 'https://example.com/catalog/intralogika-shuttle', sourceDate: '2026-02-28', confirmed: true,
  },
  {
    id: ROBOT_IDS.baggage, name: 'Аэро-Б багажный AMR', manufacturer: 'АэроРобот',
    solutionType: 'amr', solutionTypeName: AMR, objectTypes: ['airport'],
    country: 'Россия', availability: 'Поставка 12 недель',
    price: 3_900_000, raasMonthlyPrice: 105_000, maintenancePerYear: 300_000,
    specs: { payloadKg: 120, speedMps: 2.0, perfOpsPerHour: 40, autonomyH: 12, chargeTimeH: 2, positioningMm: 20, navigation: 'Лидар, SLAM, камеры', minAisleM: 1.5, widthM: 0.8, lengthM: 1.2, heightM: 0.9, lifeYears: 7 },
    sourceUrl: 'https://example.com/catalog/aero-b', sourceDate: '2026-07-01', confirmed: true,
  },
]
