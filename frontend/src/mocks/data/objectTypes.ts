import type { Assumptions, ObjectType } from '@/types/api'

export const defaultAssumptions: Assumptions = {
  horizonYears: 5,
  workDaysPerYear: 250,
  shiftsPerDay: 2,
  hoursPerShift: 8,
  utilization: 0.85,
  availability: 0.95,
  reserveShare: 0.1,
  staffReplacedShare: 0.3,
}

const warehouse: ObjectType = {
  code: 'warehouse',
  name: 'Склад',
  description:
    'Распределительный центр или склад готовой продукции: приёмка, хранение, внутреннее перемещение, отбор и отгрузка.',
  processes: [
    { code: 'receiving', name: 'Приёмка и размещение' },
    { code: 'internal_transport', name: 'Внутреннее перемещение' },
    { code: 'picking', name: 'Отбор заказов' },
    { code: 'shipping', name: 'Отгрузка' },
    { code: 'cleaning', name: 'Уборка помещений' },
  ],
  groups: [
    { key: 'object', label: 'Объект и режим работы' },
    { key: 'operations', label: 'Объёмы операций' },
    { key: 'goods', label: 'Хранение и грузовая единица' },
    { key: 'staff', label: 'Персонал' },
    { key: 'layout', label: 'Маршруты и проходы' },
  ],
  fields: [
    { key: 'areaM2', label: 'Площадь склада', group: 'object', type: 'number', unit: 'м²', required: true, min: 100, max: 500000, default: 12000, example: 12000, hint: 'Общая площадь складских помещений без офисов' },
    {
      key: 'workMode', label: 'Режим работы', group: 'object', type: 'enum', required: true, default: '2x8',
      options: [
        { value: '1x8', label: '1 смена по 8 ч' },
        { value: '2x8', label: '2 смены по 8 ч' },
        { value: '2x12', label: '2 смены по 12 ч' },
        { value: '3x8', label: 'Круглосуточно, 3 смены по 8 ч' },
      ],
      hint: 'Сколько смен в сутки работает склад',
    },
    { key: 'inboundPerDay', label: 'Входящие операции', group: 'operations', type: 'integer', unit: 'опер./сут', required: true, min: 0, max: 1000000, default: 1200, example: 1200, hint: 'Приёмка и размещение грузовых единиц за сутки' },
    { key: 'internalPerDay', label: 'Внутренние перемещения', group: 'operations', type: 'integer', unit: 'опер./сут', required: true, min: 0, max: 1000000, default: 2500, example: 2500, hint: 'Перемещения между зонами: подпитка зоны отбора, перестановки' },
    { key: 'outboundPerDay', label: 'Исходящие операции', group: 'operations', type: 'integer', unit: 'опер./сут', required: true, min: 0, max: 1000000, default: 1800, example: 1800, hint: 'Отбор и отгрузка грузовых единиц за сутки' },
    { key: 'processPerfPerHour', label: 'Требуемая производительность процесса', group: 'operations', type: 'number', unit: 'опер./ч', required: true, min: 1, max: 100000, default: 350, example: 350, hint: 'Пиковая производительность, которую должен обеспечить процесс' },
    {
      key: 'storageType', label: 'Тип хранения', group: 'goods', type: 'enum', required: true, default: 'pallet_rack',
      options: [
        { value: 'floor', label: 'Напольное' },
        { value: 'pallet_rack', label: 'Фронтальные паллетные стеллажи' },
        { value: 'shelving', label: 'Полочные стеллажи' },
        { value: 'mezzanine', label: 'Мезонин' },
        { value: 'high_bay', label: 'Высотные стеллажи (более 12 м)' },
      ],
      hint: 'Основной способ хранения товара',
    },
    { key: 'skuCount', label: 'Число SKU', group: 'goods', type: 'integer', unit: 'шт.', required: true, min: 1, max: 1000000, default: 8500, example: 8500, hint: 'Количество уникальных товарных позиций' },
    { key: 'unitWeightKg', label: 'Масса грузовой единицы', group: 'goods', type: 'number', unit: 'кг', required: true, min: 0.1, max: 5000, default: 350, example: 350, hint: 'Средняя масса перемещаемой единицы (паллета, короб)' },
    { key: 'unitLengthM', label: 'Длина грузовой единицы', group: 'goods', type: 'number', unit: 'м', required: true, min: 0.1, max: 6, default: 1.2, example: 1.2, hint: 'Для европаллеты — 1,2 м', defaultSource: { source: 'ГОСТ 33757-2016 (поддон 1200×800)', confirmed: true } },
    { key: 'unitWidthM', label: 'Ширина грузовой единицы', group: 'goods', type: 'number', unit: 'м', required: true, min: 0.1, max: 3, default: 0.8, example: 0.8, hint: 'Для европаллеты — 0,8 м', defaultSource: { source: 'ГОСТ 33757-2016 (поддон 1200×800)', confirmed: true } },
    { key: 'unitHeightM', label: 'Высота грузовой единицы', group: 'goods', type: 'number', unit: 'м', required: false, min: 0.05, max: 3, default: 1.5, example: 1.5, hint: 'Вместе с поддоном' },
    { key: 'staffCount', label: 'Численность персонала на складских операциях', group: 'staff', type: 'integer', unit: 'чел.', required: true, min: 1, max: 10000, default: 64, example: 64, hint: 'Кладовщики, водители погрузчиков, комплектовщики во всех сменах' },
    { key: 'staffCostMonthRub', label: 'Стоимость сотрудника', group: 'staff', type: 'number', unit: '₽/мес', required: true, min: 10000, max: 1000000, default: 95000, example: 95000, hint: 'Зарплата с налогами и страховыми взносами на одного сотрудника', defaultSource: { source: 'Демо-оценка по рынку труда, складская логистика, 2026', confirmed: false } },
    { key: 'avgRouteM', label: 'Средняя длина маршрута', group: 'layout', type: 'number', unit: 'м', required: true, min: 1, max: 5000, default: 120, example: 120, hint: 'Расстояние в одну сторону от зоны приёмки до места хранения' },
    { key: 'aisleWidthM', label: 'Ширина проходов', group: 'layout', type: 'number', unit: 'м', required: true, min: 0.8, max: 10, default: 3, example: 3, hint: 'Минимальная ширина рабочего прохода между стеллажами' },
  ],
  demoParams: {
    areaM2: 12000, workMode: '2x8', inboundPerDay: 1200, internalPerDay: 2500, outboundPerDay: 1800,
    processPerfPerHour: 350, storageType: 'pallet_rack', skuCount: 8500, unitWeightKg: 350,
    unitLengthM: 1.2, unitWidthM: 0.8, unitHeightM: 1.5, staffCount: 64, staffCostMonthRub: 95000,
    avgRouteM: 120, aisleWidthM: 3,
  },
  layout: {
    widthM: 120,
    heightM: 100,
    zones: [
      { id: 'z-receiving', type: 'receiving', label: 'Приёмка', rect: [0, 0, 25, 40], slots: 8 },
      { id: 'z-storage', type: 'storage', label: 'Зона хранения', rect: [30, 0, 90, 70], slots: 2400 },
      { id: 'z-picking', type: 'picking', label: 'Отбор заказов', rect: [30, 75, 60, 25], slots: 40 },
      { id: 'z-shipping', type: 'shipping', label: 'Отгрузка', rect: [0, 60, 25, 40], slots: 10 },
      { id: 'z-charging', type: 'charging', label: 'Зарядка', rect: [95, 80, 25, 20], slots: 4 },
    ],
  },
}

const airport: ObjectType = {
  code: 'airport',
  name: 'Аэропорт',
  description: 'Терминал аэропорта: обработка багажа, уборка залов, сопровождение пассажиров.',
  processes: [
    { code: 'baggage', name: 'Транспортировка багажа' },
    { code: 'cleaning', name: 'Уборка терминала' },
    { code: 'guidance', name: 'Навигация пассажиров' },
  ],
  groups: [
    { key: 'object', label: 'Терминал' },
    { key: 'operations', label: 'Пассажиропоток и багаж' },
    { key: 'staff', label: 'Персонал' },
  ],
  fields: [
    { key: 'terminalAreaM2', label: 'Площадь терминала', group: 'object', type: 'number', unit: 'м²', required: true, min: 1000, max: 1000000, default: 60000, example: 60000, hint: 'Общая площадь пассажирского терминала' },
    { key: 'hoursPerDay', label: 'Часы работы в сутки', group: 'object', type: 'integer', unit: 'ч', required: true, min: 1, max: 24, default: 24, example: 24, hint: 'Большинство терминалов работает круглосуточно' },
    { key: 'passengersPerYear', label: 'Пассажиропоток', group: 'operations', type: 'number', unit: 'млн пасс./год', required: true, min: 0.1, max: 100, default: 12, example: 12, hint: 'Годовой пассажиропоток терминала' },
    { key: 'bagsPerHourPeak', label: 'Багаж в пиковый час', group: 'operations', type: 'integer', unit: 'мест/ч', required: true, min: 1, max: 20000, default: 600, example: 600, hint: 'Число мест багажа в пиковый час' },
    { key: 'bagTransferM', label: 'Среднее расстояние перевозки багажа', group: 'operations', type: 'number', unit: 'м', required: true, min: 10, max: 5000, default: 450, example: 450, hint: 'От зоны сортировки до места стоянки ВС' },
    { key: 'cleaningAreaM2', label: 'Площадь ежедневной уборки', group: 'operations', type: 'number', unit: 'м²', required: false, min: 0, max: 1000000, default: 35000, example: 35000, hint: 'Залы, галереи и зоны ожидания' },
    { key: 'hasBaggageSystem', label: 'Есть автоматическая система обработки багажа', group: 'operations', type: 'boolean', required: true, default: true, hint: 'Конвейерная сортировка багажа (BHS)' },
    { key: 'staffCount', label: 'Численность персонала на процессах', group: 'staff', type: 'integer', unit: 'чел.', required: true, min: 1, max: 10000, default: 180, example: 180, hint: 'Грузчики, водители тягачей, уборщики во всех сменах' },
    { key: 'staffCostMonthRub', label: 'Стоимость сотрудника', group: 'staff', type: 'number', unit: '₽/мес', required: true, min: 10000, max: 1000000, default: 88000, example: 88000, hint: 'Зарплата с налогами и взносами на одного сотрудника', defaultSource: { source: 'Демо-оценка по рынку труда, 2026', confirmed: false } },
  ],
  demoParams: {
    terminalAreaM2: 60000, hoursPerDay: 24, passengersPerYear: 12, bagsPerHourPeak: 600,
    bagTransferM: 450, cleaningAreaM2: 35000, hasBaggageSystem: true, staffCount: 180, staffCostMonthRub: 88000,
  },
  layout: null,
}

const hospital: ObjectType = {
  code: 'hospital',
  name: 'Больница',
  description: 'Многопрофильный стационар: доставка лекарств, анализов, белья и питания между отделениями.',
  processes: [
    { code: 'delivery', name: 'Внутренняя доставка' },
    { code: 'disinfection', name: 'Дезинфекция помещений' },
    { code: 'cleaning', name: 'Уборка' },
  ],
  groups: [
    { key: 'object', label: 'Здание' },
    { key: 'operations', label: 'Доставки' },
    { key: 'staff', label: 'Персонал' },
  ],
  fields: [
    { key: 'beds', label: 'Коечный фонд', group: 'object', type: 'integer', unit: 'коек', required: true, min: 10, max: 5000, default: 600, example: 600, hint: 'Число коек стационара' },
    { key: 'floors', label: 'Этажность', group: 'object', type: 'integer', unit: 'этажей', required: true, min: 1, max: 40, default: 9, example: 9, hint: 'Число этажей основного корпуса' },
    { key: 'elevators', label: 'Грузовые лифты', group: 'object', type: 'integer', unit: 'шт.', required: true, min: 0, max: 50, default: 4, example: 4, hint: 'Лифты, доступные для тележек и роботов' },
    { key: 'corridorWidthM', label: 'Ширина коридоров', group: 'object', type: 'number', unit: 'м', required: true, min: 1, max: 6, default: 2.4, example: 2.4, hint: 'Минимальная ширина коридора на маршрутах доставки', defaultSource: { source: 'СП 158.13330.2014', confirmed: true } },
    { key: 'deliveriesPerDay', label: 'Доставки в сутки', group: 'operations', type: 'integer', unit: 'рейсов/сут', required: true, min: 1, max: 20000, default: 900, example: 900, hint: 'Лекарства, анализы, бельё, питание' },
    { key: 'avgRouteM', label: 'Средняя длина маршрута', group: 'operations', type: 'number', unit: 'м', required: true, min: 10, max: 3000, default: 260, example: 260, hint: 'С учётом перемещения между этажами' },
    { key: 'loadKg', label: 'Масса одной доставки', group: 'operations', type: 'number', unit: 'кг', required: true, min: 0.1, max: 500, default: 40, example: 40, hint: 'Средняя масса груза за один рейс' },
    { key: 'staffCount', label: 'Персонал на доставках', group: 'staff', type: 'integer', unit: 'чел.', required: true, min: 1, max: 5000, default: 45, example: 45, hint: 'Санитары и курьеры, занятые перемещением грузов' },
    { key: 'staffCostMonthRub', label: 'Стоимость сотрудника', group: 'staff', type: 'number', unit: '₽/мес', required: true, min: 10000, max: 1000000, default: 72000, example: 72000, hint: 'Зарплата с налогами и взносами на одного сотрудника', defaultSource: { source: 'Демо-оценка по рынку труда, 2026', confirmed: false } },
  ],
  demoParams: {
    beds: 600, floors: 9, elevators: 4, corridorWidthM: 2.4, deliveriesPerDay: 900,
    avgRouteM: 260, loadKg: 40, staffCount: 45, staffCostMonthRub: 72000,
  },
  layout: null,
}

export const objectTypes: ObjectType[] = [warehouse, airport, hospital]
